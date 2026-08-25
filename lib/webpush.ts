import webpush from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:hello@demark.ua";

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
} else {
  // eslint-disable-next-line no-console
  console.warn(
    "VAPID-ключі відсутні: перевірте NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY — надсилання push-розсилок не працюватиме."
  );
}

export { webpush };
