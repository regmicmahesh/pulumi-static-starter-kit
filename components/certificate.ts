import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface ACMCertificateArgs {
  domainName: pulumi.Input<string>;
  subjectAlternativeNames?: pulumi.Input<string[]>;
  rootDomainName: string;
}

export class ACMCertificate extends pulumi.ComponentResource {
  public readonly certificate: aws.acm.Certificate;

  constructor(
    name: string,
    args: ACMCertificateArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("my:acm:Certificate", name, {}, opts);

    this.certificate = new aws.acm.Certificate(
      name,
      {
        domainName: args.domainName,
        validationMethod: "DNS",
        subjectAlternativeNames: args.subjectAlternativeNames,
      },
      { parent: this }
    );

    const hostedZone = aws.route53.getZone(
      { name: args.rootDomainName },
      { parent: this }
    );

    const validationRecords = this.certificate.domainValidationOptions.apply(
      (el) =>
        el.map(
          (cert, i) =>
            new aws.route53.Record(
              `${name}-${i}`,
              {
                name: cert.resourceRecordName,
                records: [cert.resourceRecordValue],
                ttl: 60,
                type: cert.resourceRecordType,
                zoneId: hostedZone.then((x) => x.zoneId),
              },
              { parent: this }
            )
        )
    );

    const certificateValidations = validationRecords.apply((el) =>
      el.map(
        (record, i) =>
          new aws.acm.CertificateValidation(
            `${name}-${i}`,
            {
              certificateArn: this.certificate.arn,
              validationRecordFqdns: [record.fqdn],
            },
            { parent: this }
          )
      )
    );
  }
}
