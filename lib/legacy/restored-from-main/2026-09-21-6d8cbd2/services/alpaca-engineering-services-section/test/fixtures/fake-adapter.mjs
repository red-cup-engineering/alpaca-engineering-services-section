const orders = new Map();
export async function createAdapter(configuration) {
  const account = { id: configuration.accountReference, equity: "150", last_equity: "150", cash: "100" };
  return {
    async readAccount() { return { id: "fake-account", status: 200, payload: account }; },
    async listPositions() { return { id: "fake-positions", status: 200, payload: [{ symbol: "BLK", market_value: "50" }] }; },
    async listActivities() { return { id: "fake-activities", status: 200, payload: [] }; },
    async getOrderByClientOrderId({ clientOrderId }) { return orders.has(clientOrderId) ? { id: `fake-order:${clientOrderId}`, status: 200, payload: orders.get(clientOrderId) } : { status: 404 }; },
    async placeOrder({ order }) { orders.set(order.client_order_id, { ...order, id: "fake-fill", status: "filled", filled_avg_price: "70" }); return { id: "fake-placement", status: 200 }; },
    async cancelOrderByClientOrderId({ clientOrderId }) { orders.set(clientOrderId, { ...orders.get(clientOrderId), status: "canceled" }); return { id: "fake-cancel", status: 200 }; },
  };
}
