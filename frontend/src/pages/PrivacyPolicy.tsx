import { Fill, LegalLayout, Section, listClass } from "../components/legal/LegalLayout";
import { legalInfo } from "../lib/legalInfo";

/** Public page: describes what the application actually stores. Details marked "OWNER TO CONFIRM" are not yet supplied. */
export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="This policy explains what data Lexora processes when its operator uses it to manage brands and social media accounts."
    >
      <p className="mt-3 text-xs text-slate-500">
        Effective date: <Fill value={legalInfo.effectiveDate} />
      </p>

      <Section title="1. Who is responsible">
        <p>
          Lexora is operated by <Fill value={legalInfo.operatorName} />, <Fill value={legalInfo.operatorAddress} />.
          Privacy questions can be sent to <Fill value={legalInfo.privacyEmail} />.
        </p>
        <p>
          Lexora is an administrator tool. It has no public sign-up and no end-user accounts: only the
          operator&apos;s administrator signs in. The data below is about that administrator and about the brands and
          social accounts the administrator chooses to manage.
        </p>
      </Section>

      <Section title="2. Data Lexora stores">
        <ul className={listClass}>
          <li>
            <strong>Administrator account:</strong> email address, a hashed password (never the password itself),
            role, active status, time of last sign-in and a session counter used to sign out old sessions.
          </li>
          <li>
            <strong>Brands:</strong> name, tagline, description, hashtags, time zone and the platforms the brand plans
            to use.
          </li>
          <li>
            <strong>Connected social accounts:</strong> platform, the account&apos;s identifier on that platform,
            username, display name, profile image link, the permissions granted, token expiry, connection status and
            the most recent error message. For Facebook and Instagram this is a Facebook Page and its linked Instagram
            professional account.
          </li>
          <li>
            <strong>Access credentials:</strong> the OAuth access token (and refresh token where the platform issues
            one) for each connected account. These are encrypted before they are stored and are never sent to the
            browser. For Meta, Lexora stores the Page access token, not the personal user token.
          </li>
          <li>
            <strong>Uploaded media:</strong> images and videos you upload, kept as files on the server&apos;s storage,
            with their title, file name, type, size, target platforms, brand and uploader.
          </li>
          <li>
            <strong>Content and scheduling:</strong> titles, captions, hashtags, chosen accounts, scheduled times,
            status, and the result of each publishing attempt (the post identifier or link on the platform, or an
            error message).
          </li>
          <li>
            <strong>Reports:</strong> generated PDF, Excel or CSV reports and their settings (brand, date range,
            platforms).
          </li>
          <li>
            <strong>Activity log:</strong> for security and accountability, the administrator&apos;s email, the
            action taken, the item affected, the result, a limited amount of related detail, the IP address and the
            time.
          </li>
          <li>
            <strong>Technical data:</strong> a session cookie that keeps the administrator signed in (set to expire
            after 12 hours, or 30 days if &quot;Remember me&quot; is chosen). It is not readable by page scripts.
            Some drafting preferences may be kept in the browser&apos;s local storage.
          </li>
        </ul>
      </Section>

      <Section title="3. Why the data is used">
        <ul className={listClass}>
          <li>To let the administrator sign in and protect the application.</li>
          <li>To connect social accounts and to publish and schedule posts that the administrator creates.</li>
          <li>To organise brands, media and content, show the calendar, and produce reports.</li>
          <li>To keep a security and activity log.</li>
        </ul>
      </Section>

      <Section title="4. Social platforms and other recipients">
        <p>
          When the administrator connects an account or publishes, Lexora exchanges data with the relevant platform:
          Meta (Facebook and Instagram), Google (YouTube), LinkedIn or X. Content, captions and media are sent to the
          platform so that the post can be published, and the platform&apos;s own terms and privacy policy apply to
          that data.
        </p>
        <p>
          To publish to Instagram, the platform downloads the media file from Lexora through a temporary signed link
          that works for one file and expires after two hours.
        </p>
        <p>
          Optional AI drafting features, if the operator switches them on, send brand details and the topic entered by
          the administrator to an AI provider to produce draft text. These features are only available when the
          operator has configured them.
        </p>
        <p>
          The application and its database are hosted with <Fill value={legalInfo.hostingProvider} /> and{" "}
          <Fill value={legalInfo.databaseProvider} />.
        </p>
      </Section>

      <Section title="5. Security">
        <ul className={listClass}>
          <li>Passwords are stored as one-way hashes.</li>
          <li>Connection tokens are encrypted at rest with AES-256-GCM.</li>
          <li>Sign-in is rate limited, and the session cookie is HTTP-only.</li>
          <li>All management pages and programming interfaces require an administrator sign-in.</li>
        </ul>
        <p>No system is perfectly secure, and these measures do not guarantee that data can never be accessed.</p>
      </Section>

      <Section title="6. Retention">
        <p>
          Data is kept until it is deleted by the administrator. Retention periods, including for the activity log, are{" "}
          <Fill value={legalInfo.retention} />. Lexora does not currently delete activity-log entries automatically.
        </p>
      </Section>

      <Section title="7. Your choices and deleting data">
        <p>
          See the <a className="text-blue-700 hover:underline" href="/data-deletion">Data Deletion Instructions</a> for
          how to disconnect accounts, remove data and make a deletion request. You can also remove Lexora&apos;s access
          at any time in the settings of the connected platform.
        </p>
      </Section>

      <Section title="8. Changes and contact">
        <p>
          This policy may be updated; the effective date above will change when it is. Contact{" "}
          <Fill value={legalInfo.privacyEmail} /> with questions.
        </p>
      </Section>
    </LegalLayout>
  );
}
