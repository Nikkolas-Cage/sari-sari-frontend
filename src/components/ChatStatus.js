import { Box, HStack, Text } from "@chakra-ui/react";
import { CheckIcon } from "@chakra-ui/icons";

/** WhatsApp-style ticks: ✓ sent, ✓✓ delivered, ✓✓ (colored) read */
export function MessageTicks({ status, light = false }) {
  const muted = light ? "whiteAlpha.800" : "gray.500";
  const read = light ? "cyan.200" : "blue.400";

  if (status === "read") {
    return (
      <HStack spacing="-1" display="inline-flex" ml={1} verticalAlign="middle">
        <CheckIcon boxSize={2.5} color={read} />
        <CheckIcon boxSize={2.5} color={read} />
      </HStack>
    );
  }

  if (status === "delivered") {
    return (
      <HStack spacing="-1" display="inline-flex" ml={1} verticalAlign="middle">
        <CheckIcon boxSize={2.5} color={muted} />
        <CheckIcon boxSize={2.5} color={muted} />
      </HStack>
    );
  }

  // sent
  return (
    <Box as="span" display="inline-flex" ml={1} verticalAlign="middle">
      <CheckIcon boxSize={2.5} color={muted} />
    </Box>
  );
}

export function TypingBubble() {
  return (
    <HStack spacing={1} align="center" px={1} py={1}>
      <Text fontSize="xs" color="gray.500" fontStyle="italic">
        typing
      </Text>
      <HStack spacing={1} align="center" h="14px">
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            w="5px"
            h="5px"
            rounded="full"
            bg="gray.400"
            sx={{
              animation: "typingBounce 1.2s infinite ease-in-out",
              animationDelay: `${i * 0.15}s`,
              "@keyframes typingBounce": {
                "0%, 80%, 100%": { transform: "translateY(0)", opacity: 0.4 },
                "40%": { transform: "translateY(-3px)", opacity: 1 },
              },
            }}
          />
        ))}
      </HStack>
    </HStack>
  );
}
