export type TransferItem = {
  id: string;
  transferId?: number;
  product: string;
  from: string;
  to: string;
  quantity: number;
  date: string;
  status: string;
};

export type LocationItem = {
  id: string;
  locationId?: number;
  name: string;
  type: string;
  address: string;
  status: string;
};

export type DistributionStats = {
  total: number;
  pending: number;
  inTransit: number;
  completed: number;
};
