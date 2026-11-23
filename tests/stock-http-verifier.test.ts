import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { startShopDatabase } from "./shop-database";

vi.mock("@/lib/gateway/audit", () => ({ WRITE_TIMEOUT_MS: 3000, gatewayPort: { writeAudit: async () => {} } }));
let database: Awaited<ReturnType<typeof startShopDatabase>>, db: PrismaClient, server: Server, origin: string;
const dir=mkdtempSync(path.join(tmpdir(),"stock-http-verifier-"));
const mapping=path.join(dir,"mapping.json"), evidence=path.join(dir,"evidence.json");
const key='test-only-stock-verification-credential';
beforeAll(async()=>{
  database=await startShopDatabase();vi.stubEnv("DATABASE_URL",database.url);vi.stubEnv("IMS_SHOP_API_KEY",key);vi.stubEnv("IMS_SHOP_WAREHOUSE_ID","1000");
  ({prisma:db}=await import("@/lib/prisma"));
  const {GET,POST}=await import("@/app/api/shop/stock/route");
  await db.categories.create({data:{CategoryId:1,CategoryName:"Finished Good",Description:""}});
  await db.unitOfMeasures.create({data:{UomId:1,Name:"Piece",Abbreviation:"pcs",Code:"pcs",UomType:"Count"}});
  await db.locations.create({data:{LocationId:1000,LocationName:"Factory",LocationType:"Warehouse",IsActive:true}});
  for(const id of [1,2]){
    await db.items.create({data:{ItemId:id,ItemName:`Demo Size ${id}`,ItemCode:`SHOP-SIZE-${id}`,UomId:1,StockUomId:1,CategoryId:1,MinStockLevel:0,MaxStockLevel:100,IsActive:true}});
    await db.finishedProducts.create({data:{ProductId:id,ItemId:id,Sku:`DEMO-${id}`,Variant:'100g',SellingPrice:100}});
    await db.inventories.create({data:{ItemId:id,LocationId:1000,CurrentStock:20}});
    await db.inventoryLots.create({data:{LotId:id,ItemId:id,LocationId:1000,LotCode:`DEMO-${id}`,SourceType:'Opening',ReceivedDate:new Date(),IsExpiryEstimated:false,QuantityReceived:20,QuantityRemaining:20,UomId:1,UnitCost:0,Status:'Active',IsOpeningBalance:true}});
    // The shop sells only a Size's own lots, made by its production batches.
    const recipe=await db.recipes.create({data:{ProductId:id,OutputQuantity:1,Notes:'',IsActive:true}});
    await db.productionBatches.create({data:{RecipeId:recipe.RecipeId,ProductId:id,BatchMultiplier:1,EstimatedQuantity:20,ActualQuantity:20,ProductionDate:new Date(),Stage:'Done',QualityStatus:'Passed',RejectionReason:'',ImageUrl:'',Notes:'',FgLotId:id,Status:'Completed'}});
  }
  let dropDeductReply=true;
  server=createServer(async(req,res)=>{
    try{
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
      const body=Buffer.concat(chunks).toString();const headers=new Headers();
      for(const [name,value]of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
      const request=new Request(`http://localhost${req.url}`,{method:req.method,headers,...(body?{body}:{})});
      const response=await(req.method==='POST'?POST(request):GET(request));
      if(body&&JSON.parse(body).operation==='deduct'&&response.status===200&&dropDeductReply){dropDeductReply=false;req.socket.destroy();return;}
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
    }catch{res.writeHead(500);res.end('{}');}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw Error('No test HTTP port');origin=`http://127.0.0.1:${address.port}`;
  writeFileSync(mapping,JSON.stringify({'1':1,'2':2}));
},60000);
afterAll(async()=>{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await db?.$disconnect();database?.close();rmSync(dir,{recursive:true,force:true});vi.unstubAllEnvs();});
it("restores deducted demo stock after the successful deduction reply is lost",async()=>{
  await expect(promisify(execFile)(process.execPath,['scripts/verification/verify-stock-http.mjs',origin,mapping,evidence],{
    env:{...process.env,IMS_SHOP_API_KEY:key,IMS_GATEWAY_URL:origin,IMS_GATEWAY_AUDIT_READ_CALLER_KEY:'test-read'},
  })).rejects.toThrow();
  const response=await fetch(origin+'/api/shop/stock?productId=1',{headers:{Authorization:`Bearer ${key}`}});
  expect(await response.json()).toMatchObject({quantity:20,reserved:0,available:20});
  const proof=JSON.parse(readFileSync(evidence,'utf8'));expect(proof.completed).toBe(false);expect(proof.cleanupComplete).toBe(true);
},30000);
