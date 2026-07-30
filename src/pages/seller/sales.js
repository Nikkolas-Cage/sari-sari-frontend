import {
  Box,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Badge,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { api } from "@/lib/api";

export default function SellerSales() {
  const [sales, setSales] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function loadSales() {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = `${to}T23:59:59`;
    const data = await api.getSales(params);
    setSales(data.sales);
  }

  useEffect(() => {
    loadSales().catch(console.error);
  }, []);

  return (
    <ProtectedRoute role="seller">
      <Layout title="Sales History">
        <Box bg="white" p={6} rounded="lg" shadow="sm" mb={6}>
          <HStack spacing={4}>
            <FormControl maxW="200px">
              <FormLabel fontSize="sm">From</FormLabel>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </FormControl>
            <FormControl maxW="200px">
              <FormLabel fontSize="sm">To</FormLabel>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </FormControl>
            <Box pt={8}>
              <Badge
                as="button"
                colorScheme="teal"
                px={3}
                py={2}
                cursor="pointer"
                onClick={loadSales}
              >
                Filter
              </Badge>
            </Box>
          </HStack>
        </Box>

        <Box bg="white" p={6} rounded="lg" shadow="sm" overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Date</Th>
                <Th>Items</Th>
                <Th>Buyer</Th>
                <Th isNumeric>Total</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sales.map((sale) => (
                <Tr key={sale.id}>
                  <Td>{new Date(sale.timestamp).toLocaleString()}</Td>
                  <Td>
                    {sale.items.map((item) => (
                      <Text key={item.id} fontSize="sm">
                        {item.name} × {item.qty} @ ₱{item.unitPrice.toFixed(2)}
                      </Text>
                    ))}
                  </Td>
                  <Td>{sale.buyerName || "In-person (POS)"}</Td>
                  <Td isNumeric>₱{sale.totalAmount.toFixed(2)}</Td>
                </Tr>
              ))}
              {sales.length === 0 && (
                <Tr>
                  <Td colSpan={4} textAlign="center" color="gray.500">
                    No sales recorded yet
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
