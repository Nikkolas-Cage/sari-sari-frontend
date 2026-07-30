import {
  Badge,
  Box,
  Flex,
  HStack,
  Icon,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useToast,
} from "@chakra-ui/react";
import {
  CheckCircleIcon,
  EditIcon,
  StarIcon,
  ViewIcon,
} from "@chakra-ui/icons";
import NextLink from "next/link";
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

const QUICK_ACTIONS = [
  {
    href: "/seller/products",
    label: "Products",
    hint: "Manage inventory",
    icon: EditIcon,
  },
  {
    href: "/seller/pos",
    label: "POS",
    hint: "Scan & sell",
    icon: ViewIcon,
  },
  {
    href: "/seller/orders",
    label: "Pickup",
    hint: "Confirm orders",
    icon: CheckCircleIcon,
  },
  {
    href: "/seller/analytics",
    label: "Analytics",
    hint: "Views & clicks",
    icon: StarIcon,
  },
];

function QuickAction({ href, label, hint, icon }) {
  return (
    <Box
      as={NextLink}
      href={href}
      display="block"
      bg="white"
      borderWidth="1px"
      borderColor="gray.100"
      rounded="2xl"
      px={{ base: 3, md: 5 }}
      py={{ base: 4, md: 5 }}
      textAlign="center"
      transition="all 0.2s ease"
      _hover={{
        borderColor: "teal.200",
        shadow: "md",
        transform: "translateY(-2px)",
        textDecoration: "none",
      }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "teal.400",
        outlineOffset: "2px",
      }}
    >
      <Flex
        mx="auto"
        mb={3}
        align="center"
        justify="center"
        w={{ base: 11, md: 12 }}
        h={{ base: 11, md: 12 }}
        rounded="full"
        bg="teal.50"
        color="teal.600"
      >
        <Icon as={icon} boxSize={{ base: 5, md: 6 }} />
      </Flex>
      <Text fontWeight="semibold" fontSize={{ base: "sm", md: "md" }} color="gray.800">
        {label}
      </Text>
      <Text fontSize="xs" color="gray.500" mt={0.5} display={{ base: "none", sm: "block" }}>
        {hint}
      </Text>
    </Box>
  );
}

export default function SellerDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState({ products: 0, lowStock: 0, sales: 0, revenue: 0 });
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    async function load() {
      const [allProducts, lowStockProducts, salesData, analyticsData] = await Promise.all([
        api.getProducts(),
        api.getProducts({ lowStock: "true" }),
        api.getSales(),
        api.getAnalytics().catch(() => null),
      ]);
      const sales = salesData.sales || [];
      const revenue = sales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
      setStats({
        products: allProducts.products.length,
        lowStock: lowStockProducts.products.length,
        sales: sales.length,
        revenue,
      });
      setAnalytics(analyticsData);
    }
    load().catch((err) => toast({ title: err.message, status: "error" }));
  }, [toast]);

  useEffect(() => {
    return subscribeRealtime((msg) => {
      if (msg?.type !== "analytics:update" || !msg.product) return;
      setAnalytics((prev) => applyAnalyticsUpdate(prev, msg.product));
    });
  }, []);

  const products = analytics?.products || [];
  const byCategory = analytics?.byCategory || [];
  const totals = analytics?.totals || { views: 0, clicks: 0, products: 0, stock: 0 };

  return (
    <ProtectedRoute role="seller">
      <Layout title="Seller Dashboard">
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={{ base: 3, md: 4 }} mb={6}>
          {QUICK_ACTIONS.map((action) => (
            <QuickAction key={action.href} {...action} />
          ))}
        </SimpleGrid>

        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
          <Stat bg="white" p={5} rounded="2xl" borderWidth="1px" borderColor="gray.100">
            <StatLabel color="gray.500">Total Products</StatLabel>
            <StatNumber>{stats.products}</StatNumber>
          </Stat>
          <Stat bg="white" p={5} rounded="2xl" borderWidth="1px" borderColor="gray.100">
            <StatLabel color="gray.500">Low Stock</StatLabel>
            <StatNumber color={stats.lowStock > 0 ? "red.500" : "inherit"}>
              {stats.lowStock}
            </StatNumber>
          </Stat>
          <Stat bg="white" p={5} rounded="2xl" borderWidth="1px" borderColor="gray.100">
            <StatLabel color="gray.500">Orders / Sales</StatLabel>
            <StatNumber>{stats.sales}</StatNumber>
          </Stat>
          <Stat bg="white" p={5} rounded="2xl" borderWidth="1px" borderColor="gray.100">
            <StatLabel color="gray.500">Revenue</StatLabel>
            <StatNumber>₱{stats.revenue.toFixed(2)}</StatNumber>
          </Stat>
        </SimpleGrid>

        {analytics && (
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mb={6}>
            <Box bg="white" p={5} rounded="2xl" borderWidth="1px" borderColor="gray.100">
              <Text fontWeight="semibold" mb={1}>
                Views & clicks by product
              </Text>
              <Text fontSize="sm" color="gray.500" mb={4}>
                {totals.views} views · {totals.clicks} clicks across {totals.products} products
              </Text>
              <Box h="280px">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={products.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="views" fill="#319795" name="Views" />
                    <Bar dataKey="clicks" fill="#805AD5" name="Clicks" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>

            <Box bg="white" p={5} rounded="2xl" borderWidth="1px" borderColor="gray.100">
              <Text fontWeight="semibold" mb={1}>
                By category
              </Text>
              <Text fontSize="sm" color="gray.500" mb={4}>
                Stock and engagement by category
              </Text>
              <Box h="280px">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCategory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="stock" fill="#38A169" name="Stock" />
                    <Bar dataKey="views" fill="#3182CE" name="Views" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </SimpleGrid>
        )}

        {products.length > 0 && (
          <Box bg="white" p={5} rounded="2xl" borderWidth="1px" borderColor="gray.100">
            <Text fontWeight="semibold" mb={3}>
              Top products
            </Text>
            {products.slice(0, 5).map((p, idx) => (
              <HStack
                key={p.id}
                justify="space-between"
                py={2}
                borderBottomWidth={idx === Math.min(4, products.length - 1) ? 0 : "1px"}
                borderColor="gray.100"
              >
                <Box>
                  <Text fontWeight="medium">{p.name}</Text>
                  <Badge colorScheme="purple">{p.category}</Badge>
                </Box>
                <Text fontSize="sm" color="gray.500">
                  {p.views} views · {p.clicks} clicks
                </Text>
              </HStack>
            ))}
          </Box>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
