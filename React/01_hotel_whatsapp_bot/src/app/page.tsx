import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

export default function Page() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h1" component="h1" gutterBottom>
        Hotel WhatsApp Bot
      </Typography>
      <Typography variant="body1" color="text.secondary">
        MVP w budowie — wracaj wkrótce.
      </Typography>
    </Container>
  );
}
