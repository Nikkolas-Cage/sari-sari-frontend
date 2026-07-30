import {
  Box,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

function useAuthToast() {
  const toast = useToast();

  return (message, status = "error") => {
    if (!message) return;
    if (String(message).toLowerCase().includes("seller or buyer")) return;
    toast({
      title: status === "error" ? "Something went wrong" : "Success",
      description: message,
      status,
      duration: 4500,
      isClosable: true,
      position: "top",
    });
  };
}

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <Box
      minH="100vh"
      position="relative"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={4}
      py={10}
      backgroundImage="url('/loginpagebkg.jpg')"
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
    >
      <Box
        position="absolute"
        inset={0}
        bg="blackAlpha.450"
        pointerEvents="none"
      />
      <Box
        position="relative"
        zIndex={1}
        bg="white"
        p={{ base: 6, md: 8 }}
        rounded="2xl"
        shadow="xl"
        borderWidth="1px"
        borderColor="gray.100"
        w="full"
        maxW="440px"
      >
        <Text
          fontSize="xs"
          fontWeight="bold"
          letterSpacing="widest"
          textTransform="uppercase"
          color="teal.600"
          mb={2}
        >
          Sari-Sari Store
        </Text>
        <Heading size="lg" mb={2}>
          {title}
        </Heading>
        <Text mb={6} color="gray.600">
          {subtitle}
        </Text>
        {children}
        {footer}
      </Box>
    </Box>
  );
}

export default function AuthMethods({ mode = "login", role = null, onNeedsProfile }) {
  const { login, register, resetPassword, loginWithGoogle, sendPhoneCode, verifyPhoneCode } =
    useAuth();
  const showToast = useAuthToast();
  const isSignup = mode === "signup";

  const [email, setEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phoneStep, setPhoneStep] = useState("phone");
  const [phone, setPhone] = useState("+63");
  const [code, setCode] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);

  const [finishOpen, setFinishOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [finishLoading, setFinishLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setEmailLoading(true);
    try {
      if (isSignup) {
        if (!role) throw new Error("Please choose Seller or Buyer");
        if (!email.trim()) throw new Error("Please enter your email address");
        setUsername(email.trim().split("@")[0] || "");
        setNewPassword("");
        setConfirmPassword("");
        setFinishOpen(true);
        return;
      }

      const result = await login(email.trim(), loginPassword, role);
      if (result.status === "needs_profile") onNeedsProfile?.();
    } catch (err) {
      if (
        err.code === "NEEDS_PROFILE" ||
        String(err.message || "").toLowerCase().includes("seller or buyer")
      ) {
        onNeedsProfile?.();
      } else {
        showToast(err.message);
      }
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleFinishSetup(e) {
    e.preventDefault();
    if (!username.trim()) {
      showToast("Please enter a username");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match");
      return;
    }

    setFinishLoading(true);
    try {
      const result = await register({
        name: username.trim(),
        email: email.trim(),
        password: newPassword,
        role,
      });
      setFinishOpen(false);
      if (result.status === "needs_profile") onNeedsProfile?.();
      else showToast("Account ready — welcome!", "success");
    } catch (err) {
      showToast(err.message);
    } finally {
      setFinishLoading(false);
    }
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail.trim() || email.trim());
      showToast("Password reset email sent. Check your inbox.", "success");
      setForgotOpen(false);
    } catch (err) {
      showToast(err.message);
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);

    let settled = false;
    const clearLoading = () => {
      if (!settled) {
        settled = true;
        setGoogleLoading(false);
      }
    };
    const onFocus = () => {
      window.setTimeout(clearLoading, 400);
    };
    window.addEventListener("focus", onFocus);

    try {
      const result = await loginWithGoogle(role, { isSignup });
      if (result.status === "needs_profile") onNeedsProfile?.();
    } catch (err) {
      if (err.code !== "POPUP_CLOSED" && !String(err.message).toLowerCase().includes("cancelled")) {
        if (
          err.code === "NEEDS_PROFILE" ||
          String(err.message || "").toLowerCase().includes("seller or buyer")
        ) {
          onNeedsProfile?.();
        } else {
          showToast(err.message);
        }
      }
    } finally {
      window.removeEventListener("focus", onFocus);
      clearLoading();
    }
  }

  async function handleSendCode(e) {
    e.preventDefault();
    setPhoneLoading(true);
    try {
      await sendPhoneCode(phone.trim());
      setPhoneStep("code");
      showToast(`Verification code sent to ${phone}`, "success");
    } catch (err) {
      showToast(err.message);
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setPhoneLoading(true);
    try {
      const result = await verifyPhoneCode(code.trim(), role, { isSignup });
      if (result.status === "needs_profile") onNeedsProfile?.();
    } catch (err) {
      if (
        err.code === "NEEDS_PROFILE" ||
        String(err.message || "").toLowerCase().includes("seller or buyer")
      ) {
        onNeedsProfile?.();
      } else {
        showToast(err.message);
      }
    } finally {
      setPhoneLoading(false);
    }
  }

  return (
    <VStack spacing={5} align="stretch">
      <Button
        onClick={handleGoogle}
        isLoading={googleLoading}
        variant="outline"
        borderWidth="2px"
        h="48px"
        leftIcon={
          <Text as="span" fontWeight="bold" color="red.500">
            G
          </Text>
        }
      >
        Continue with Google
      </Button>

      <HStack>
        <Divider />
        <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
          or
        </Text>
        <Divider />
      </HStack>

      <Tabs isFitted variant="enclosed" colorScheme="teal" size="sm">
        <TabList mb={3}>
          <Tab>Email</Tab>
          <Tab>Phone</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <form onSubmit={handleEmailSubmit}>
              <VStack spacing={3} align="stretch">
                <FormControl isRequired>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </FormControl>

                {!isSignup && (
                  <FormControl isRequired>
                    <FormLabel>Password</FormLabel>
                    <Input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Your password"
                    />
                  </FormControl>
                )}

                <Button type="submit" colorScheme="teal" h="44px" isLoading={emailLoading}>
                  {isSignup ? "Continue" : "Sign in"}
                </Button>

                {!isSignup && (
                  <Text fontSize="sm" textAlign="center">
                    <Link
                      color="teal.600"
                      fontWeight="semibold"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotOpen(true);
                      }}
                    >
                      Forgot password?
                    </Link>
                  </Text>
                )}

                {isSignup && (
                  <Text fontSize="xs" color="gray.500" textAlign="center">
                    Next you&apos;ll set a username and password to finish setup.
                  </Text>
                )}
              </VStack>
            </form>
          </TabPanel>

          <TabPanel px={0}>
            {phoneStep === "phone" ? (
              <form onSubmit={handleSendCode}>
                <VStack spacing={3} align="stretch">
                  <FormControl isRequired>
                    <FormLabel>Phone number</FormLabel>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+639171234567"
                    />
                    <FormHelperText>Include country code, e.g. +639171234567</FormHelperText>
                  </FormControl>
                  <Button type="submit" colorScheme="teal" h="44px" isLoading={phoneLoading}>
                    Send verification code
                  </Button>
                </VStack>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode}>
                <VStack spacing={3} align="stretch">
                  <Text fontSize="sm" color="gray.600">
                    Enter the code sent to <b>{phone}</b>
                  </Text>
                  <FormControl isRequired>
                    <FormLabel>Verification code</FormLabel>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="6-digit code"
                      letterSpacing="0.2em"
                      textAlign="center"
                      fontSize="lg"
                    />
                  </FormControl>
                  <Button type="submit" colorScheme="teal" h="44px" isLoading={phoneLoading}>
                    Verify & continue
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPhoneStep("phone");
                      setCode("");
                    }}
                  >
                    Use a different number
                  </Button>
                </VStack>
              </form>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      <div id="recaptcha-container" />

      {/* Finish email account setup */}
      <Modal
        isOpen={finishOpen}
        onClose={() => !finishLoading && setFinishOpen(false)}
        isCentered
        closeOnOverlayClick={!finishLoading}
      >
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent as="form" onSubmit={handleFinishSetup}>
          <ModalHeader>Finish account setup</ModalHeader>
          <ModalCloseButton isDisabled={finishLoading} />
          <ModalBody>
            <Text mb={4} fontSize="sm" color="gray.600">
              Creating <b>{email}</b> as <b>{role || "member"}</b>. Choose a username and password
              before entering the portal.
            </Text>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Username</FormLabel>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. juan_store"
                  autoFocus
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Confirm password</FormLabel>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => setFinishOpen(false)}
              isDisabled={finishLoading}
            >
              Cancel
            </Button>
            <Button type="submit" colorScheme="teal" isLoading={finishLoading}>
              Create & continue
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Forgot password */}
      <Modal
        isOpen={forgotOpen}
        onClose={() => !forgotLoading && setForgotOpen(false)}
        isCentered
        closeOnOverlayClick={!forgotLoading}
      >
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent as="form" onSubmit={handleForgotSubmit}>
          <ModalHeader>Reset password</ModalHeader>
          <ModalCloseButton isDisabled={forgotLoading} />
          <ModalBody>
            <Text mb={4} fontSize="sm" color="gray.600">
              Enter the email for your account. We&apos;ll send a Firebase reset link.
            </Text>
            <FormControl isRequired>
              <FormLabel>Email</FormLabel>
              <Input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@email.com"
                autoFocus
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => setForgotOpen(false)}
              isDisabled={forgotLoading}
            >
              Cancel
            </Button>
            <Button type="submit" colorScheme="teal" isLoading={forgotLoading}>
              Send reset link
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}

export function CompleteProfileModal({ isOpen, onClose }) {
  const { pendingProfile, completeSocialProfile, cancelPendingProfile } = useAuth();
  const showToast = useAuthToast();
  const [name, setName] = useState("");
  const [role, setRole] = useState("buyer");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pendingProfile?.suggestedName) {
      setName(pendingProfile.suggestedName);
    }
  }, [pendingProfile]);

  async function handleClose() {
    await cancelPendingProfile();
    onClose?.();
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await completeSocialProfile({
        name: name || pendingProfile?.suggestedName,
        role,
      });
      showToast("Welcome! Your account is ready.", "success");
      onClose?.();
    } catch (err) {
      showToast(err.message || "Could not finish account setup. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      isCentered
      closeOnOverlayClick={!loading}
      closeOnEsc={!loading}
    >
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent>
        <ModalHeader>Finish account setup</ModalHeader>
        <ModalCloseButton isDisabled={loading} />
        <ModalBody>
          <Text mb={4} fontSize="sm" color="gray.600">
            You&apos;re signed in as <b>{pendingProfile?.email}</b>. Choose a display name and role
            before portal access.
          </Text>
          <Stack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Username</FormLabel>
              <Input
                placeholder={pendingProfile?.suggestedName || "Your username"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>I am a</FormLabel>
              <RadioGroup value={role} onChange={setRole}>
                <HStack spacing={6}>
                  <Radio value="seller">Seller</Radio>
                  <Radio value="buyer">Buyer</Radio>
                </HStack>
              </RadioGroup>
            </FormControl>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose} isDisabled={loading}>
            Cancel
          </Button>
          <Button colorScheme="teal" onClick={handleSubmit} isLoading={loading}>
            Continue to portal
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
