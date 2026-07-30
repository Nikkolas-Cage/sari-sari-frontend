import {
  Box,
  FormControl,
  FormLabel,
  HStack,
  Link,
  Text,
  VStack,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useState } from "react";
import AuthMethods, { AuthShell, CompleteProfileModal } from "@/components/SocialAuthButtons";
import { useAuth } from "@/lib/auth";

function RolePicker({ value, onChange }) {
  return (
    <FormControl isRequired mb={5}>
      <FormLabel>Register as</FormLabel>
      <HStack spacing={3} align="stretch">
        <Box
          as="button"
          type="button"
          flex="1"
          p={4}
          rounded="xl"
          borderWidth="2px"
          borderColor={value === "seller" ? "teal.500" : "gray.200"}
          bg={value === "seller" ? "teal.50" : "white"}
          textAlign="left"
          onClick={() => onChange("seller")}
          _hover={{ borderColor: "teal.400" }}
        >
          <Text fontWeight="bold" color={value === "seller" ? "teal.700" : "gray.800"}>
            Seller
          </Text>
          <Text fontSize="sm" color="gray.600" mt={1}>
            Manage inventory, POS, and sales
          </Text>
        </Box>
        <Box
          as="button"
          type="button"
          flex="1"
          p={4}
          rounded="xl"
          borderWidth="2px"
          borderColor={value === "buyer" ? "orange.400" : "gray.200"}
          bg={value === "buyer" ? "orange.50" : "white"}
          textAlign="left"
          onClick={() => onChange("buyer")}
          _hover={{ borderColor: "orange.300" }}
        >
          <Text fontWeight="bold" color={value === "buyer" ? "orange.700" : "gray.800"}>
            Buyer
          </Text>
          <Text fontSize="sm" color="gray.600" mt={1}>
            Browse stores and place orders
          </Text>
        </Box>
      </HStack>
    </FormControl>
  );
}

export default function SignupPage() {
  const { pendingProfile } = useAuth();
  const [role, setRole] = useState("seller");
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <AuthShell
      title="Create account"
      subtitle="Choose Seller or Buyer, then continue with Google, email, or phone. Same email can switch roles."
      footer={
        <VStack mt={6} spacing={2}>
          <Text fontSize="sm" color="gray.600" textAlign="center">
            Already have an account?{" "}
            <Link as={NextLink} href="/login" color="teal.600" fontWeight="semibold">
              Sign in
            </Link>
          </Text>
          <Text fontSize="xs" color="gray.500" textAlign="center">
            Already a buyer? Choose Seller and continue to switch this email to a store account.
          </Text>
        </VStack>
      }
    >
      <RolePicker value={role} onChange={setRole} />

      <AuthMethods
        mode="signup"
        role={role}
        onNeedsProfile={() => setShowProfileModal(true)}
      />

      <CompleteProfileModal
        isOpen={showProfileModal || !!pendingProfile}
        onClose={() => setShowProfileModal(false)}
      />
    </AuthShell>
  );
}
