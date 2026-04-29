import Box from "@mui/material/Box";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "grey.50",
      }}
    >
      <LoginForm />
    </Box>
  );
}
