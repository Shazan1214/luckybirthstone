import { Link } from "wouter";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-foreground mb-3">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
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
            <h1 className="text-2xl font-bold text-foreground mb-1">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: March 2026</p>
          </div>

          <Section title="1. Introduction">
            <p>
              LuckyBirthstone ("we", "us", or "our") operates the LuckyBirthstone marketplace platform at luckybirthstone.com.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use our services.
            </p>
            <p>
              By using LuckyBirthstone, you agree to the collection and use of information in accordance with this policy.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p><strong>Account information:</strong> When you register, we collect your name, company name, email address, user type, and password (stored encrypted).</p>
            <p><strong>Verification documents:</strong> For verified sellers, we collect trade licence numbers, trade licence documents, and government-issued identity documents. These are used solely for identity and business verification.</p>
            <p><strong>Listing data:</strong> Gemstone listings you create, including descriptions, pricing, images, and videos.</p>
            <p><strong>Communications:</strong> Messages exchanged between buyers and sellers on the platform.</p>
            <p><strong>Usage data:</strong> IP addresses, browser type, pages visited, and time spent on the platform for analytics and security purposes.</p>
            <p><strong>Contact inquiries:</strong> Name and email address submitted via our public contact form.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide, operate, and maintain the LuckyBirthstone marketplace</li>
              <li>Verify business identities to build a trusted trading network</li>
              <li>Send transactional emails (OTP, verification approval, new message notifications)</li>
              <li>Process and display listings to buyers</li>
              <li>Respond to support requests and contact inquiries</li>
              <li>Detect, prevent, and address fraudulent activity</li>
              <li>Comply with applicable legal obligations</li>
            </ul>
          </Section>

          <Section title="4. Information Sharing">
            <p>We do not sell your personal data. We share limited information only in these circumstances:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Public profiles:</strong> Company name, user type, verification badge, rating, and website are visible to other users. Email, phone number, and government ID are never displayed publicly.</li>
              <li><strong>Between traders:</strong> When a buyer contacts a seller, only the message content is shared through our secure messaging system. Contact details are never revealed automatically.</li>
              <li><strong>Service providers:</strong> We use Resend for transactional emails and Google Cloud Storage for document uploads. These are bound by confidentiality agreements.</li>
              <li><strong>Legal compliance:</strong> We may disclose information if required by law or to protect the rights and safety of our users.</li>
            </ul>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your account data for as long as your account is active. Verification documents are retained for a minimum of 3 years for compliance purposes.
              You may request deletion of your account and associated data by reaching out via our <a href="/contact" className="text-primary hover:underline">Contact page</a>.
            </p>
          </Section>

          <Section title="6. Security">
            <p>
              We implement industry-standard security measures including encrypted data transmission (HTTPS), encrypted password storage, and access controls.
              However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="7. Cookies">
            <p>
              LuckyBirthstone uses browser localStorage to maintain your session (user ID and email verification status).
              We do not use third-party tracking cookies or advertising cookies.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to processing of your data</li>
              <li>Data portability</li>
            </ul>
            <p>To exercise these rights, please use our <a href="/contact" className="text-primary hover:underline">Contact page</a>.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify registered users by email of material changes.
              Continued use of the platform after changes constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              For privacy-related questions or concerns, please use our <a href="/contact" className="text-primary hover:underline">Contact page</a>.
            </p>
          </Section>
        </div>

        <div className="mt-6 text-center">
          <Link href="/contact">
            <span className="text-sm text-primary hover:underline cursor-pointer">Contact Us</span>
          </Link>
          <span className="text-muted-foreground mx-2">·</span>
          <Link href="/terms">
            <span className="text-sm text-primary hover:underline cursor-pointer">Terms & Conditions</span>
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
