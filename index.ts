import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

import { S3Website } from "./components/s3website";
import { ACMCertificate } from "./components/certificate";

const stackConfig = new pulumi.Config();

const config = {
  domainName: stackConfig.require("domainName"),
  rootDomainName: stackConfig.require("rootDomainName"),
};

const zone = aws.route53.getZone({ name: config.rootDomainName });

const acmCertificate = new ACMCertificate("static-assets-certificate", {
  domainName: config.domainName,
  rootDomainName: config.rootDomainName,
});

const s3Website = new S3Website("static-assets", {
  domainName: config.domainName,
  indexFilePath: "./static/index.html",
  zoneId: zone.then((z) => z.zoneId),
  certificateArn: acmCertificate.certificate.arn,
});
