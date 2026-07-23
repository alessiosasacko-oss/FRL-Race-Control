import Button from "@/components/ui/Button";
import { signInWithDiscord } from "@/lib/auth/actions";

type DiscordSignInButtonProps = {
  callbackUrl?: string;
  text?: string;
};

export default function DiscordSignInButton({
  callbackUrl = "/dashboard",
  text = "Mit Discord anmelden",
}: DiscordSignInButtonProps) {
  return (
    <form action={signInWithDiscord}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Button text={text} type="submit" />
    </form>
  );
}
