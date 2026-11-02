import { Link } from "react-router-dom";
import { Fill, LegalLayout, Section, listClass } from "../components/legal/LegalLayout";
import { legalInfo } from "../lib/legalInfo";

/** Public page: explains what can be removed today and how to ask for it. Does not promise more than the app does. */
export default function DataDeletion() {
  return (
    <LegalLayout
      title="Data Deletion Instructions"
      intro="Lexora has no end-user accounts. Its data belongs to the operator's administrator and to the brands and social accounts that administrator connected. This page explains how to have that data removed."
    >
      <Section title="1. Remove Lexora's access on the platform">
        <p>
          You can always withdraw Lexora&apos;s permission yourself, without contacting us. In your Facebook,
          Instagram, Google, LinkedIn or X account settings, find the list of connected apps or business integrations and
          remove Lexora. The exact menu names are set by each platform and may change. After you do this, Lexora can no
          longer use that permission.
        </p>
      </Section>

      <Section title="2. Ask us to delete your data">
        <p>
          Email <Fill value={legalInfo.privacyEmail} /> from the address you used or can prove you control, and tell us:
        </p>
        <ul className={listClass}>
          <li>which platform and account (name or page link) is involved, and</li>
          <li>that you want the data deleted.</li>
        </ul>
        <p>
          We aim to respond within <Fill value={legalInfo.dataDeletionResponseTime} />. Deletion requests are handled by
          a person, not automatically, and there is no automated confirmation code or status page. We may need to
          confirm that you control the account before acting.
        </p>
      </Section>

      <Section title="3. What the administrator can remove today">
        <ul className={listClass}>
          <li>
            <strong>Disconnect a social account.</strong> This marks the account disconnected and erases the stored
            access and refresh tokens from Lexora&apos;s database. It does not remove the permission on the
            platform&apos;s side; use step 1 for that. The account&apos;s identifying details (platform ID, username,
            display name) remain in Lexora&apos;s records until the brand is deleted.
          </li>
          <li>
            <strong>Delete content and media.</strong> Posts can be deleted one by one, and an uploaded file is deleted
            from storage when its media item is deleted. A media item that is still used by a post cannot be deleted
            until it is removed from that post.
          </li>
          <li>
            <strong>Delete reports</strong> one by one.
          </li>
          <li>
            <strong>Delete a brand.</strong> This is allowed only after all of its connected accounts are disconnected
            and all of its media, content and reports are removed. It then deletes the brand and its social-account
            records.
          </li>
        </ul>
      </Section>

      <Section title="4. What is not removed by these tools">
        <ul className={listClass}>
          <li>
            Posts already published to a platform stay on that platform until you delete them there.
          </li>
          <li>
            The activity log (which includes the administrator&apos;s email and IP address) and any stored AI draft
            history have no in-app delete function. They would have to be handled directly by the operator, and how
            requests concerning them are handled is <Fill value={legalInfo.retention} />.
          </li>
          <li>Backups, if the operator keeps any, are subject to the operator&apos;s own schedule.</li>
        </ul>
      </Section>

      <Section title="5. More information">
        <p>
          See the <Link className="text-blue-700 hover:underline" to="/privacy">Privacy Policy</Link> for what Lexora
          stores and why.
        </p>
      </Section>
    </LegalLayout>
  );
}
