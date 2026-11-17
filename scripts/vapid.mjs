// Makes the key pair for push notifications (once). Put the public key in NEXT_PUBLIC_VAPID_PUBLIC_KEY and the
// private key in VAPID_PRIVATE_KEY (Vercel → Settings → Environment Variables). Keep the private key secret.
import webpush from "web-push";
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}`);
