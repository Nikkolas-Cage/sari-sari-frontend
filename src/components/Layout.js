import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Heading,
  HStack,
  IconButton,
  Link,
  Text,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import {
  ChatIcon,
  CalendarIcon,
  HamburgerIcon,
  InfoIcon,
  BellIcon,
  SettingsIcon,
  StarIcon,
  TimeIcon,
} from "@chakra-ui/icons";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import NotificationBell from "@/components/NotificationBell";
import FloatingChat from "@/components/FloatingChat";

export const SELLER_NAV = [
  { href: "/seller", label: "Dashboard", icon: StarIcon },
  { href: "/seller/products", label: "Products", icon: InfoIcon },
  { href: "/seller/analytics", label: "Analytics", icon: StarIcon },
  { href: "/seller/pos", label: "POS", icon: TimeIcon },
  { href: "/seller/orders", label: "Pickup Orders", icon: CalendarIcon },
  { href: "/seller/sales", label: "Sales History", icon: StarIcon },
  { href: "/seller/notifications", label: "Notifications", icon: BellIcon },
  { href: "/seller/messages", label: "Messages", icon: ChatIcon },
  { href: "/seller/settings", label: "Account Settings", icon: SettingsIcon },
];

export const BUYER_NAV = [
  { href: "/buyer", label: "Shop", icon: StarIcon },
  { href: "/buyer/cart", label: "Cart", icon: InfoIcon },
  { href: "/buyer/orders", label: "My Orders", icon: CalendarIcon },
  { href: "/buyer/notifications", label: "Notifications", icon: BellIcon },
  { href: "/buyer/messages", label: "Messages", icon: ChatIcon },
  { href: "/buyer/settings", label: "Account Settings", icon: SettingsIcon },
];

export default function Layout({ title, children, navLinks }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const links =
    navLinks ||
    (user?.role === "seller" ? SELLER_NAV : user?.role === "buyer" ? BUYER_NAV : []);

  const settingsHref = user?.role === "seller" ? "/seller/settings" : "/buyer/settings";
  const needsSetup = user && !user.setupComplete;

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="teal.600" color="white" py={3} shadow="md">
        <Container maxW="container.xl">
          <Flex justify="space-between" align="center">
            <HStack spacing={3}>
              <IconButton
                aria-label="Open menu"
                variant="ghost"
                colorScheme="whiteAlpha"
                color="white"
                onClick={onOpen}
                icon={<HamburgerIcon boxSize={5} />}
              />
              <Heading size="md">Sari-Sari Store</Heading>
            </HStack>

            {user && (
              <HStack spacing={3}>
                <NotificationBell />
                <HStack
                  as={NextLink}
                  href={settingsHref}
                  spacing={2}
                  _hover={{ opacity: 0.9 }}
                >
                  <Avatar
                    size="sm"
                    name={user.name}
                    src={user.avatarUrl || undefined}
                    bg="teal.300"
                  />
                  <Box display={{ base: "none", md: "block" }}>
                    <Text fontSize="sm" fontWeight="semibold" lineHeight="short">
                      {user.name}
                    </Text>
                    <Text fontSize="xs" opacity={0.85}>
                      {user.role}
                    </Text>
                  </Box>
                </HStack>
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="whiteAlpha"
                  onClick={logout}
                  display={{ base: "none", md: "inline-flex" }}
                >
                  Logout
                </Button>
              </HStack>
            )}
          </Flex>
        </Container>
      </Box>

      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">
            <HStack>
              <Avatar size="sm" name={user?.name} src={user?.avatarUrl || undefined} />
              <Box>
                <Text fontSize="md">{user?.name}</Text>
                <Text fontSize="xs" color="gray.500" textTransform="capitalize">
                  {user?.role} account
                </Text>
              </Box>
            </HStack>
          </DrawerHeader>
          <DrawerBody>
            <VStack align="stretch" spacing={1} mt={2}>
              {links.map((link) => {
                const active = router.pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    as={NextLink}
                    href={link.href}
                    onClick={onClose}
                    px={3}
                    py={3}
                    rounded="md"
                    fontWeight={active ? "bold" : "medium"}
                    bg={active ? "teal.50" : "transparent"}
                    color={active ? "teal.700" : "gray.700"}
                    _hover={{ bg: "gray.100" }}
                  >
                    <HStack spacing={3}>
                      {Icon ? <Icon /> : null}
                      <Text>{link.label}</Text>
                    </HStack>
                  </Link>
                );
              })}
              <Divider my={3} />
              <Button colorScheme="red" variant="outline" onClick={logout}>
                Logout
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {links.length > 0 && (
        <Box bg="white" borderBottom="1px" borderColor="gray.200" display={{ base: "none", md: "block" }}>
          <Container maxW="container.xl">
            <HStack spacing={6} py={3} overflowX="auto">
              {links.map((link) => {
                const Icon = link.icon;
                const active = router.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    as={NextLink}
                    href={link.href}
                    fontWeight={active ? "bold" : "medium"}
                    color={active ? "teal.600" : "gray.700"}
                    whiteSpace="nowrap"
                  >
                    <HStack spacing={2}>
                      {Icon ? <Icon boxSize={3.5} /> : null}
                      <Text as="span">{link.label}</Text>
                    </HStack>
                  </Link>
                );
              })}
            </HStack>
          </Container>
        </Box>
      )}

      <Container maxW="container.xl" py={8}>
        {needsSetup && (
          <Alert status="warning" mb={6} rounded="md" alignItems="flex-start">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle>Finish account setup</AlertTitle>
              <AlertDescription display="block">
                Add a profile photo and password (if needed) before using all features.
              </AlertDescription>
            </Box>
            <Button as={NextLink} href={settingsHref} size="sm" colorScheme="orange" ml={3}>
              Account settings
            </Button>
          </Alert>
        )}

        {title && (
          <Heading size="lg" mb={6}>
            {title}
          </Heading>
        )}
        {children}
      </Container>
      <FloatingChat />
    </Box>
  );
}
