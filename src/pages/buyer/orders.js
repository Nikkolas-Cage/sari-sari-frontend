import {
  Badge,
  Box,
  Button,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { subscribeRealtime } from "@/lib/realtime";

const STATUS_COLOR = {
  pending: "orange",
  confirmed: "blue",
  ready: "purple",
  completed: "green",
  cancelled: "red",
};

const STATUS_HINT = {
  pending: "Waiting for seller confirmation",
  confirmed: "Seller confirmed — preparing your bag",
  ready: "Ready! Pick up at the sari-sari store",
  completed: "Picked up",
  cancelled: "Cancelled",
};

export default function BuyerOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);

  async function load() {
    const d = await api.getSales();
    setOrders(d.sales || []);
  }

  useEffect(() => {
    load().catch(console.error);
    return subscribeRealtime((msg) => {
      if (msg?.type === "order:created" || msg?.type === "order:status") {
        load().catch(console.error);
        if (msg.type === "order:status") {
          toast({
            title: "Order update",
            description: STATUS_HINT[msg.order?.status] || msg.order?.status,
            status: "info",
            isClosable: true,
          });
        }
      }
    });
  }, [toast]);

  async function cancelOrder(id) {
    try {
      await api.updateOrderStatus(id, "cancelled");
      await load();
    } catch (err) {
      toast({ title: err.message, status: "error" });
    }
  }

  return (
    <ProtectedRoute role="buyer">
      <Layout title="My Pickup Orders">
        <Text mb={4} color="gray.600">
          All orders are for in-store pickup. Track confirmation in real time.
        </Text>
        <Box bg="white" p={6} rounded="lg" shadow="sm" overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Date</Th>
                <Th>Store</Th>
                <Th>Status</Th>
                <Th>Items</Th>
                <Th isNumeric>Total</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {orders.map((order) => (
                <Tr key={order.id}>
                  <Td>{new Date(order.timestamp).toLocaleString()}</Td>
                  <Td>{order.sellerName || "Store"}</Td>
                  <Td>
                    <Badge colorScheme={STATUS_COLOR[order.status] || "gray"}>
                      {order.status || "pending"}
                    </Badge>
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {STATUS_HINT[order.status] || "Pickup"}
                    </Text>
                  </Td>
                  <Td>
                    {order.items.map((item) => (
                      <Text key={item.id || `${item.productId}-${item.name}`} fontSize="sm">
                        {item.name} × {item.qty}
                      </Text>
                    ))}
                  </Td>
                  <Td isNumeric>₱{Number(order.totalAmount).toFixed(2)}</Td>
                  <Td>
                    {order.status === "pending" && (
                      <Button size="xs" variant="ghost" colorScheme="red" onClick={() => cancelOrder(order.id)}>
                        Cancel
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
              {orders.length === 0 && (
                <Tr>
                  <Td colSpan={6} textAlign="center" color="gray.500">
                    No pickup orders yet
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Box>
      </Layout>
    </ProtectedRoute>
  );
}
