import { Link } from "wouter";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-foreground mb-3">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function MarketplacePolicyPage() {
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
            <h1 className="text-2xl font-bold text-foreground mb-1">Marketplace Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: March 2026</p>
          </div>

          <div className="bg-primary/5 border border-primary/15 rounded-xl px-5 py-4 mb-8">
            <p className="text-sm font-semibold text-primary mb-1">Our Commitment</p>
            <p className="text-sm text-muted-foreground">
              LuckyBirthstone is built on trust. These policies exist to protect all participants — buyers, sellers, and the integrity of the global gemstone trade.
            </p>
          </div>

          <Section title="1. Listing Standards">
            <p>All gemstone listings on LuckyBirthstone must meet the following standards:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Accuracy:</strong> All details (stone type, carat weight, origin, treatment, colour, clarity) must accurately describe the physical gemstone being offered.</li>
              <li><strong>Transparency on treatment:</strong> Any enhancement or treatment (heat, oiling, fracture filling, irradiation, etc.) must be disclosed. "Untreated" claims require supporting lab certification.</li>
              <li><strong>Origin claims:</strong> Geographic origin claims (e.g. Kashmir sapphire, Burmese ruby) must be supported by recognised laboratory reports if requested by a buyer.</li>
              <li><strong>Certification:</strong> Lab reports from GIA, GRS, Gübelin, AGL, IGI, or equivalent bodies are strongly encouraged and increase buyer confidence.</li>
              <li><strong>Pricing:</strong> Prices must be the genuine asking price. Artificially inflated prices followed by heavy "discounts" are prohibited.</li>
              <li><strong>Images:</strong> All images must depict the actual gemstone listed. Stock images, CGI renders, or images of different stones are strictly prohibited.</li>
            </ul>
          </Section>

          <Section title="2. Prohibited Listings">
            <p>The following are prohibited on LuckyBirthstone:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Synthetic or lab-grown stones listed or described as natural without clear disclosure</li>
              <li>Conflict minerals as defined by the Kimberley Process (for diamonds) or equivalent frameworks</li>
              <li>Gemstones with disputed ownership or unclear chain of custody</li>
              <li>Imitation or simulant stones (e.g. glass, cubic zirconia) listed as genuine gemstones</li>
              <li>Gemstones subject to international sanctions or import/export restrictions</li>
              <li>Any item that violates CITES regulations for protected species (coral, tortoiseshell, ivory)</li>
            </ul>
          </Section>

          <Section title="3. Seller Responsibilities">
            <p>As a seller on LuckyBirthstone, you are responsible for:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Maintaining accurate and up-to-date inventory listings</li>
              <li>Removing listings for gemstones that have already been sold</li>
              <li>Responding to buyer inquiries within a reasonable time</li>
              <li>Honouring agreed-upon terms of sale</li>
              <li>Complying with all applicable export laws and regulations in your country</li>
              <li>Providing accurate grading and documentation when requested</li>
            </ul>
          </Section>

          <Section title="4. Buyer Responsibilities">
            <p>Buyers must conduct their own due diligence. LuckyBirthstone strongly recommends:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Requesting independent gemological certification before completing large purchases</li>
              <li>Verifying the seller's LuckyBirthstone verification status (Basic or Premium Verified)</li>
              <li>Using secure payment methods with appropriate buyer protections</li>
              <li>Confirming all terms (price, payment method, shipping, insurance) in writing before payment</li>
              <li>Arranging your own trade insurance for high-value shipments</li>
            </ul>
          </Section>

          <Section title="5. Pricing & Currency">
            <p>
              Prices on LuckyBirthstone are indicative asking prices only. Prices are displayed in the seller's chosen currency (USD, INR, AED, THB) with real-time currency conversions for reference.
              Currency conversions are updated automatically using live exchange rates.
            </p>
            <p>
              All prices shown are exclusive of shipping, insurance, customs duties, taxes, and any other applicable charges. These are negotiated directly between buyer and seller.
            </p>
          </Section>

          <Section title="6. Verification Badges">
            <p>LuckyBirthstone offers two seller verification tiers:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>🔵 Basic Verified:</strong> Identity verification completed. Trade licence submitted and reviewed. Email address confirmed.
              </li>
              <li>
                <strong>⭐ Premium Verified:</strong> All Basic Verified requirements plus enhanced due diligence, priority listing, and premium trust badge visible to all buyers.
              </li>
            </ul>
            <p>
              Verification confirms business identity — it does not constitute an endorsement of the quality, authenticity, or value of any listed gemstone.
              LuckyBirthstone is not responsible for disputes arising from transactions with verified sellers.
            </p>
          </Section>

          <Section title="7. Messaging & Contact">
            <p>
              All buyer-seller communication must occur through LuckyBirthstone's secure messaging system.
              Contact details (phone, email, WhatsApp) may not be shared in initial messages.
              Once both parties have agreed to proceed with a deal, contact details may be exchanged.
            </p>
            <p>
              This policy protects both parties from fraud and helps LuckyBirthstone maintain a safe trading environment.
              Users who attempt to circumvent the messaging system may have their accounts suspended.
            </p>
          </Section>

          <Section title="8. Dispute Resolution">
            <p>
              LuckyBirthstone is a marketplace platform and does not arbitrate commercial disputes between buyers and sellers.
              In the event of a dispute:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Both parties should first attempt to resolve the matter directly</li>
              <li>If unresolved, reach out via our <a href="/contact" className="text-primary hover:underline">Contact page</a> and we will review the situation</li>
              <li>LuckyBirthstone may suspend accounts pending investigation of serious complaints</li>
              <li>For high-value disputes, we recommend seeking independent legal or arbitration services</li>
            </ul>
          </Section>

          <Section title="9. Policy Violations">
            <p>
              Violations of this Marketplace Policy may result in:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Removal of the offending listing without notice</li>
              <li>Temporary suspension of the seller's account</li>
              <li>Permanent account termination for repeat or severe violations</li>
              <li>Reporting to relevant authorities where illegal activity is suspected</li>
            </ul>
          </Section>

          <Section title="10. Updates to This Policy">
            <p>
              This Marketplace Policy may be updated periodically to reflect changes in market practice or platform features.
              Registered users will be notified of material changes by email.
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
          <Link href="/terms">
            <span className="text-sm text-primary hover:underline cursor-pointer">Terms & Conditions</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
