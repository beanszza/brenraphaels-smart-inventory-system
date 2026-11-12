interface RequestSearchRow {
  priority: string;
  reqNumber: string;
  productName: string;
  recipeName: string;
  requestedBy: string;
  batches?: Array<{ batchNumber?: string }>;
}

export function productionPriority(value: string) {
  return value === "Priority" || value === "High" ? "High" : value === "Low" ? "Low" : "Medium";
}

export function filterProductionRequests<T extends RequestSearchRow>(rows: T[], search: string, priority: string) {
  const query = search.trim().toLowerCase();
  return rows.filter(row => (priority === "All" || productionPriority(row.priority) === priority)
    && (!query || [row.reqNumber, row.batches?.[0]?.batchNumber, row.productName, row.recipeName, row.requestedBy]
      .some(value => value?.toLowerCase().includes(query))));
}
