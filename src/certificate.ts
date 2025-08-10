import { md, pki } from "node-forge";

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;

export const generateIdentity = (nbHours = 1) => {
  const host = "localhost";

  const cert = pki.createCertificate();

  // NOTE: serialNumber is the hex encoded value of an ASN.1 INTEGER.
  // Conforming CAs should ensure serialNumber is:
  // - no more than 20 octets
  // - non-negative (prefix a '00' if your value starts with a '1' bit)
  // cert.serialNumber = Buffer.from(random.getBytesSync(16)).toString("hex");
  cert.serialNumber = "01";

  cert.validity.notBefore = new Date(Date.now() - 30 * ONE_SECOND);
  cert.validity.notAfter = new Date(Date.now() + ONE_HOUR * nbHours);

  cert.setSubject([
    {
      name: "commonName",
      value: host,
    },
    {
      name: "organizationName",
      value: "HashiCorp",
    },
  ]);
  cert.setExtensions([
    {
      cA: true,
      name: "basicConstraints",
    },
    {
      digitalSignature: true,
      keyAgreement: true,
      keyCertSign: true,
      keyEncipherment: true,
      name: "keyUsage",
    },
    {
      clientAuth: true,
      name: "extKeyUsage",
      serverAuth: true,
    },
    {
      altNames: [
        {
          type: 2, // DNS
          value: host,
        },
      ],
      name: "subjectAltName",
    },
  ]);

  //     let ec_group = EcGroup::from_curve_name(Nid::SECP384R1)?;
  //     let ec_key = EcKey::generate(&ec_group)?;
  //     let pkey = PKey::from_ec_key(ec_key)?;
  //     certificate.sign(&pkey, MessageDigest::sha384())?;

  const keys = pki.rsa.generateKeyPair(2048);
  // const keys = pki.ed25519.generateKeyPair();
  cert.publicKey = keys.publicKey;

  cert.sign(keys.privateKey, md.sha384.create());
  // cert.sign(keys.privateKey);

  return { cert, keys };
};
