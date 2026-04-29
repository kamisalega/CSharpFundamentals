import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";
import { loginAction } from "./actions";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(loginAction, null);

  return (
    <Box
      component="form"
      action={formAction}
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: 360 }}
    >
      <Typography variant="h5" component="h1">
        Panel recepcji
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
        slotProps={{ htmlInput: { "data-testid": "email-input" } }}
      />
      <TextField
        name="password"
        label="Hasło"
        type="password"
        required
        autoComplete="current-password"
        slotProps={{ htmlInput: { "data-testid": "password-input" } }}
      />
      <Button type="submit" variant="contained" disabled={isPending}>
        {isPending ? "Logowanie..." : "Zaloguj"}
      </Button>
    </Box>
  );
}
