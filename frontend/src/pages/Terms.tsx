import { Link } from "react-router-dom";
import { Fill, LegalLayout, Section, listClass } from "../components/legal/LegalLayout";
import { legalInfo } from "../lib/legalInfo";

/** Public draft. Not reviewed by a lawyer; bracketed items must be supplied by the owner. */
export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro="Draft terms for using Lexora. These terms have not been reviewed by a lawyer and must be checked before publication."
    >
      <p className="mt-3 text-xs text-slate-500">
        Effective date: <Fill value={legalInfo.effectiveDate} />
      </p>

      <Section title="1. The service">
        <p>
          Lexora is a tool for managing brands, uploading media, creating and scheduling content, and publishing it to
          social media accounts the administrator connects (such as Facebook, Instagram, YouTube, LinkedIn and X). It
          is provided by <Fill value={legalInfo.operatorName} />. Access is limited to administrators created by the
          operator.
        </p>
      </Section>

      <Section title="2. Access and accounts">
        <ul className={listClass}>
          <li>Keep your sign-in details confidential and tell the operator if you suspect unauthorised access.</li>
          <li>You may connect only accounts you own or are authorised to manage.</li>
          <li>The operator may suspend or end access at any time.</li>
        </ul>
      </Section>

      <Section title="3. Content and third-party platforms">
        <ul className={listClass}>
          <li>You are responsible for the content you upload and publish and for having the rights to use it.</li>
          <li>
            Publishing is subject to each platform&apos;s own terms, policies and technical limits. Lexora does not
            guarantee that a post will be accepted or published, or that a platform&apos;s permissions will be
            available.
          </li>
          <li>You must not use Lexora for unlawful, deceptive, abusive or spam content.</li>
        </ul>
      </Section>

      <Section title="4. Availability">
        <p>
          The service is provided &quot;as is&quot; and may change or be interrupted. Scheduled posts depend on the
          service running at the scheduled time.
        </p>
      </Section>

      <Section title="5. Liability">
        <p>
          <Fill value="[OWNER TO CONFIRM: limitation of liability wording, to be written with legal advice]" />
        </p>
      </Section>

      <Section title="6. Privacy">
        <p>
          How data is handled is described in the <Link className="text-blue-700 hover:underline" to="/privacy">Privacy
          Policy</Link>, and removal of data in the{" "}
          <Link className="text-blue-700 hover:underline" to="/data-deletion">Data Deletion Instructions</Link>.
        </p>
      </Section>

      <Section title="7. Governing law and contact">
        <p>
          These terms are governed by <Fill value={legalInfo.governingLaw} />. Questions: <Fill value={legalInfo.privacyEmail} />.
        </p>
      </Section>
    </LegalLayout>
  );
}
