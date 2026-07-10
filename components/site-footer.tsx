import Link from "next/link";
import { footer } from "../content/site-content";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        {footer.disclosure}{" "}
        <Link href={footer.privacyHref}>Privacy details.</Link>
      </p>
    </footer>
  );
}
