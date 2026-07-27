import { Link } from "wouter";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-foreground mb-3">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/">
          <span className="flex items-center gap-2 font-bold text-lg text-primary cursor-pointer mb-8 w-fit">
            <span className="text-2xl">💎</span> LuckyBirthstone
          </span>
        </Link>

        <div className="bg-white border border-border rounded-2xl p-8 shadow-sm">
          <div className="mb-8 pb-6 border-b border-border">
            <h1 className="text-2xl font-bold text-foreground mb-1">Terms & Conditions</h1>
            <p className="text-sm text-muted-foreground">Last updated: March 2026</p>
          </div>

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using the LuckyBirthstone marketplace ("Platform"), you agree to be bound by these Terms & Conditions.
              If you do not agree to these terms, you may not use the Platform.
            </p>
            <p>
              These terms apply to all users, including sellers, buyers, and any person who accesses the Platform for any purpose.
            </p>
          </Section>

          <Section title="2. Platform Description">
            <p>
              LuckyBirthstone is a B2B (business-to-business) gemstone marketplace that connects verified traders, miners, and manufacturers globally.
              We provide a platform for listing, discovering, and initiating trade. LuckyBirthstone does not participate in, guarantee, or process payments for any transaction between buyers and sellers.
            </p>
          </Section>

          <Section title="3. Eligibility">
            <p>
              You must be at least 18 years old and represent a legitimate business to use LuckyBirthstone. By creating an account, you represent that:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>All registration information you provide is accurate and truthful</li>
              <li>You have the legal authority to bind any business entity you represent</li>
              <li>Your use of the Platform complies with all applicable laws in your jurisdiction</li>
            </ul>
          </Section>

          <Section title="4. Account Registration & Security">
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.
              Notify us immediately via the Contact page if you suspect any unauthorised use of your account.
            </p>
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms, contain fraudulent information, or are used for prohibited activities.
            </p>
          </Section>

          <Section title="5. Listings & Content">
            <p>Sellers are solely responsible for the accuracy of their listings. You agree that all listings you post:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Accurately describe the gemstone including origin, treatment, and certification status</li>
              <li>Do not infringe any intellectual property rights</li>
              <li>Do not list conflict minerals or goods obtained through illegal means</li>
              <li>Comply with all applicable import/export laws</li>
              <li>Include only genuine images and descriptions of the actual goods being offered</li>
            </ul>
            <p>
              LuckyBirthstone reserves the right to remove any listing that violates these terms without notice.
            </p>
          </Section>

          <Section title="6. Subscriptions">
            <p>
              LuckyBirthstone offers optional paid subscription plans (Growth, Pro) that unlock additional listing quota and platform features.
              Subscription fees are charged in advance on a monthly or annual basis.
            </p>
            <p className="font-semibold text-foreground">
              ⚠️ No Refund Policy: All subscription fees are non-refundable. Once a subscription payment is processed, no refunds will be issued for any reason, including but not limited to: early cancellation, non-use of the platform, or downgrade requests. By subscribing, you explicitly acknowledge and agree to this no-refund policy.
            </p>
            <p>
              Subscriptions automatically renew unless cancelled before the renewal date. You may cancel at any time through your account settings. Cancellation takes effect at the end of the current billing period.
            </p>
          </Section>

          <Section title="7. Verification Services">
            <p>
              Seller verification is an optional paid service. Verification fees are non-refundable once the verification process has commenced.
              LuckyBirthstone verifies business identity and trade documentation but does not guarantee the quality, authenticity, or legal compliance of any listed gemstone.
            </p>
            <p>
              Free verification slots are available to the first 50 qualifying users as part of a launch promotion. This promotion may be withdrawn at any time without notice.
            </p>
          </Section>

          <Section title="8. Transactions">
            <p>
              LuckyBirthstone facilitates introductions between buyers and sellers. All transactions are conducted directly between parties.
              LuckyBirthstone does not:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Process, hold, or guarantee any payment</li>
              <li>Provide escrow services</li>
              <li>Act as an agent, broker, or intermediary in any sale</li>
              <li>Verify the quality, authenticity, or legal status of any gemstone</li>
            </ul>
            <p>
              Transaction records on LuckyBirthstone are for reference only and do not constitute a binding contract between parties.
            </p>
          </Section>

          <Section title="9. Zero Commission">
            <p>
              LuckyBirthstone does not charge commission on any transaction between buyers and sellers.
              Our revenue is derived solely from optional subscription plans and verification services.
            </p>
          </Section>

          <Section title="10. Prohibited Activities">
            <p>You agree not to use the Platform to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>List counterfeit, stolen, or illegally sourced gemstones</li>
              <li>Engage in fraudulent or deceptive practices</li>
              <li>Harass, threaten, or intimidate other users</li>
              <li>Scrape, harvest, or otherwise collect user data without consent</li>
              <li>Attempt to gain unauthorised access to any part of the Platform</li>
              <li>Use the Platform for money laundering or any other illegal activity</li>
            </ul>
          </Section>

          <Section title="11. Intellectual Property">
            <p>
              All content on the Platform created by LuckyBirthstone (including design, logos, and code) is owned by us and protected by applicable intellectual property laws.
              You retain ownership of content you post (listings, images) but grant us a non-exclusive licence to display it on the Platform.
            </p>
          </Section>

          <Section title="12. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, LuckyBirthstone shall not be liable for any indirect, incidental, special, consequential, or punitive damages,
              including but not limited to loss of profits, loss of data, or loss of goodwill arising from your use of the Platform.
            </p>
            <p>
              Our total liability to you for any claim arising from your use of the Platform shall not exceed the fees paid by you to LuckyBirthstone in the 12 months preceding the claim.
            </p>
          </Section>

          <Section title="13. Governing Law">
            <p>
              These Terms & Conditions are governed by and construed in accordance with applicable commercial law.
              Any disputes shall be resolved through good-faith negotiation, and if unresolved, through binding arbitration.
            </p>
          </Section>

          <Section title="14. Changes to Terms">
            <p>
              We reserve the right to modify these terms at any time. Material changes will be communicated to registered users by email at least 14 days before taking effect.
              Continued use of the Platform after the effective date constitutes acceptance of the updated terms.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              For questions about these Terms & Conditions, please use our <a href="/contact" className="text-primary hover:underline">Contact page</a>.
            </p>
          </Section>
        </div>

        <div className="mt-6 text-center">
          <Link href="/contact">
            <span className="text-sm text-primary hover:underline cursor-pointer">Contact Us</span>
          </Link>
          <span className="text-muted-foreground mx-2">·</span>
          <Link href="/privacy">
            <span className="text-sm text-primary hover:underline cursor-pointer">Privacy Policy</span>
          </Link>
          <span className="text-muted-foreground mx-2">·</span>
          <Link href="/marketplace-policy">
            <span className="text-sm text-primary hover:underline cursor-pointer">Marketplace Policy</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
