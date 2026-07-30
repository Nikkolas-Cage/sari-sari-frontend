import {
  Badge,
  Box,
  SimpleGrid,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { applyAnalyticsUpdate } from "@/lib/analyticsRealtime";
import { api } from "@/lib/api";
import { subscribeRealtime } from "@/lib/realtime";

export default function SellerAnalytics() {
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .getAnalytics()
      .then(setData)
      .catch((err) => toast({ title: err.message, status: "error" }));
  }, [toast]);

  useEffect(() => {
    return subscribeRealtime((msg) => {
      if (msg?.type !== "analytics:update" || !msg.product) return;
      setData((prev) => applyAnalyticsUpdate(prev, msg.product));
    });
  }, []);

  const products = data?.products || [];
  const byCategory = data?.byCategory || [];
  const totals = data?.totals || { views: 0, clicks: 0, products: 0, stock: 0 };

  return (
    <ProtectedRoute role="seller">
      <Layout title="Analytics">
        <Text color="gray.600" mb={6}>
          Product views, clicks, and engagement across your sari-sari store.
        </Text>

        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={8}>
          <Box bg="white" p={4} rounded="lg" shadow="sm">
            <Stat>
              <StatLabel>Total views</StatLabel>
              <StatNumber>{totals.views}</StatNumber>
              <StatHelpText>Product detail opens</StatHelpText>
            </Stat>
          </Box>
          <Box bg="white" p={4} rounded="lg" shadow="sm">
            <Stat>
              <StatLabel>Total clicks</StatLabel>
              <StatNumber>{totals.clicks}</StatNumber>
              <StatHelpText>Cart / inquire taps</StatHelpText>
            </Stat>
          </Box>
          <Box bg="white" p={4} rounded="lg" shadow="sm">
            <Stat>
              <StatLabel>Products</StatLabel>
              <StatNumber>{totals.products}</StatNumber>
            </Stat>
          </Box>
          <Box bg="white" p={4} rounded="lg" shadow="sm">
            <Stat>
              <StatLabel>Units in stock</StatLabel>
              <StatNumber>{totals.stock}</StatNumber>
            </Stat>
          </Box>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={8}>
          <Box bg="white" p={4} rounded="lg" shadow="sm" h="360px">
            <Text fontWeight="bold" mb={3}>
              Top products — views & clicks
            </Text>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={products.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="views" fill="#319795" name="Views" />
                <Bar dataKey="clicks" fill="#DD6B20" name="Clicks" />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <Box bg="white" p={4} rounded="lg" shadow="sm" h="360px">
            <Text fontWeight="bold" mb={3}>
              Engagement by category
            </Text>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="views" fill="#2B6CB0" name="Views" />
                <Bar dataKey="clicks" fill="#805AD5" name="Clicks" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SimpleGrid>

        <Box bg="white" p={4} rounded="lg" shadow="sm">
          <Text fontWeight="bold" mb={3}>
            Product ranking
          </Text>
          {products.map((p, idx) => (
            <Box
              key={p.id}
              py={2}
              borderBottomWidth={idx === products.length - 1 ? 0 : "1px"}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              gap={3}
            >
              <Box>
                <Text fontWeight="medium">{p.name}</Text>
                <Badge colorScheme="purple">{p.category}</Badge>
              </Box>
              <Text fontSize="sm" color="gray.600" whiteSpace="nowrap">
                {p.views} views · {p.clicks} clicks · stock {p.stock}
              </Text>
            </Box>
          ))}
          {products.length === 0 && (
            <Text color="gray.500" textAlign="center" py={6}>
              No product data yet. Views and clicks appear when buyers browse your shop.
            </Text>
          )}
        </Box>
      </Layout>
    </ProtectedRoute>
  );
}
