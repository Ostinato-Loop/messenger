import React from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import loopLogo from "@assets/IMG_3832_1779368920403.jpeg";

const LAST_UPDATED = "21 May 2026";
const EFFECTIVE = "21 May 2026";

export default function TermsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:text-primary"
          onClick={() => setLocation("/auth")}
          data-testid="button-back-terms"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Terms & Privacy Policy</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto px-4 py-8 space-y-8"
      >
        {/* Brand header */}
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <div className="w-12 h-12 rounded-2xl overflow-hidden border border-primary/30 shadow-[0_0_16px_rgba(255,107,0,0.2)] flex-shrink-0">
            <img src={loopLogo} alt="Loop Messenger" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Loop Messenger</h1>
            <p className="text-xs text-muted-foreground">Owned and operated by Lilcky Studio Limited</p>
          </div>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Last Updated: {LAST_UPDATED}</p>
          <p>Effective Date: {EFFECTIVE}</p>
        </div>

        <Section title="1. Agreement to Terms">
          <p>
            By accessing or using Loop Messenger ("the App", "the Service"), you agree to be bound by these Terms and
            Conditions ("Terms"). The Service is owned and operated by <strong className="text-foreground">Lilcky Studio Limited</strong>,
            a company incorporated under the laws of Nigeria ("Lilcky Studio", "we", "us", or "our").
          </p>
          <p>
            If you do not agree to these Terms, you must not access or use the Service. By registering, you confirm
            that you are at least 13 years of age and have the legal capacity to enter into a binding agreement.
          </p>
        </Section>

        <Section title="2. About the Service">
          <p>
            Loop Messenger is a real-time communications platform enabling users to send messages, share media, create
            group conversations, and connect with others. The App uses phone number-based authentication (OTP) powered
            by the RALD Auth infrastructure.
          </p>
        </Section>

        <Section title="3. Account Registration & OTP Authentication">
          <ul>
            <li>You must provide a valid phone number to register.</li>
            <li>A one-time password (OTP) will be sent via SMS to verify your identity.</li>
            <li>You are responsible for keeping your session and device secure.</li>
            <li>You must not share OTP codes with any third party.</li>
            <li>We reserve the right to suspend accounts we believe are fraudulent, abusive, or in violation of these Terms.</li>
          </ul>
        </Section>

        <Section title="4. Acceptable Use Policy">
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Send spam, unsolicited messages, or bulk commercial communications.</li>
            <li>Harass, threaten, or intimidate any individual.</li>
            <li>Distribute malware, viruses, or any harmful code.</li>
            <li>Engage in illegal activities or promote violence.</li>
            <li>Impersonate any person or entity.</li>
            <li>Attempt to gain unauthorised access to any systems or user data.</li>
            <li>Transmit content that infringes intellectual property rights.</li>
            <li>Engage in activities that disrupt or degrade the performance of the Service.</li>
          </ul>
          <p>
            Violation of this policy may result in immediate account termination and, where applicable, reporting to
            law enforcement authorities.
          </p>
        </Section>

        <Section title="5. Privacy & Data Collection">
          <p>We collect and process the following data to provide the Service:</p>
          <ul>
            <li><strong className="text-foreground">Phone Number</strong> — used for identity verification via OTP.</li>
            <li><strong className="text-foreground">Display Name & Avatar</strong> — user-provided profile information.</li>
            <li><strong className="text-foreground">Messages & Media</strong> — content you send through the platform.</li>
            <li><strong className="text-foreground">Device & Session Data</strong> — for security and authentication purposes.</li>
            <li><strong className="text-foreground">Usage Analytics</strong> — anonymised data to improve the Service.</li>
          </ul>
          <p>
            We do not sell your personal data to third parties. Data may be shared with essential service providers
            (e.g., OTP delivery via TERMII) strictly for the purpose of delivering the Service.
          </p>
          <p>
            All data is processed in accordance with applicable Nigerian data protection laws (NDPR 2019) and, where
            relevant, the General Data Protection Regulation (GDPR).
          </p>
        </Section>

        <Section title="6. Message Content & End-to-End Encryption">
          <p>
            Loop Messenger stores messages on secure servers to enable sync across devices and conversation history.
            You retain ownership of all content you create. By using the Service, you grant Lilcky Studio a limited,
            non-exclusive licence to host and transmit your content solely for the purpose of providing the Service.
          </p>
        </Section>

        <Section title="7. Intellectual Property">
          <p>
            The Loop Messenger name, logo (the RALD infinity mark), branding, design system, and all software
            comprising the Service are the exclusive intellectual property of Lilcky Studio Limited. You may not copy,
            reproduce, modify, distribute, or create derivative works without express written consent.
          </p>
        </Section>

        <Section title="8. Service Availability & Modifications">
          <p>
            We aim to provide the Service 24/7 but do not guarantee uninterrupted availability. We may modify,
            suspend, or discontinue any part of the Service at any time. We will endeavour to provide reasonable
            notice of material changes.
          </p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, Lilcky Studio Limited shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising from your use of the Service. Our total
            liability shall not exceed the amount you have paid for the Service in the 12 months preceding the claim.
          </p>
        </Section>

        <Section title="10. Indemnification">
          <p>
            You agree to indemnify and hold harmless Lilcky Studio Limited, its officers, employees, and agents from
            any claims, liabilities, damages, costs, and expenses arising from your use of the Service or your
            violation of these Terms.
          </p>
        </Section>

        <Section title="11. Governing Law & Dispute Resolution">
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of
            Nigeria. Any disputes arising shall be subject to the exclusive jurisdiction of the courts of Nigeria.
          </p>
        </Section>

        <Section title="12. Changes to These Terms">
          <p>
            We may update these Terms from time to time. Continued use of the Service after any modification
            constitutes your acceptance of the updated Terms. We will notify you via in-app notice or push
            notification for material changes.
          </p>
        </Section>

        <Section title="13. Contact Us">
          <p>For questions about these Terms or our Privacy Policy, contact:</p>
          <div className="bg-card border border-border rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold text-foreground">Lilcky Studio Limited</p>
            <p className="text-muted-foreground">Loop Messenger — Legal & Compliance</p>
            <p className="text-primary">legal@lilcky.studio</p>
            <p className="text-muted-foreground">Nigeria</p>
          </div>
        </Section>

        <div className="pt-4 pb-12 border-t border-border text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} Lilcky Studio Limited. All rights reserved. Loop Messenger is a registered
          product of Lilcky Studio Limited.
        </div>
      </motion.div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground space-y-2 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:font-medium">
        {children}
      </div>
    </section>
  );
}
