import webpush from "web-push";

const vapidKeys = webpush.generateVAPIDKeys();

console.log("Add these to your .env and Vercel environment variables:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`\nThe public key (NEXT_PUBLIC_) is exposed to the browser for push subscription.`);
console.log(`The private key must be kept secret (server-side only).`);
