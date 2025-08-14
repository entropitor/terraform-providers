import forge from "node-forge";
import { generateIdentity } from "../libs/hashicorp-plugin/certificate.js";

const { cert: serverCertificate, keys } = generateIdentity(24 * 365 * 10);
const cert = forge.pki.certificateToPem(serverCertificate);
const key = forge.pki.privateKeyToPem(keys.privateKey);

const certInAsn1 = forge.util
  .encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(serverCertificate)).getBytes(),
  )
  // Remove padding
  .replace(/=*$/, "");

console.log("Certificate:");
console.log(cert);
console.log("====================\nPrivate key:");
console.log(key);
console.log("====================\nServer certificate string:");
console.log(certInAsn1);
