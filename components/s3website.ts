import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface S3WebsiteArgs {
  domainName: pulumi.Input<string>;
  indexFilePath: string;
  certificateArn: pulumi.Input<string>;
  zoneId: pulumi.Input<string>;
}

export class S3Website extends pulumi.ComponentResource {
  public readonly bucket: aws.s3.Bucket;

  constructor(
    name: string,
    args: S3WebsiteArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("my:s3:Website", name, {}, opts);

    this.bucket = new aws.s3.Bucket(name, {
      bucket: args.domainName,
      website: {
        indexDocument: "index.html",
        errorDocument: "index.html",
      },
    });
    const allowPublicAccess = new aws.s3.BucketPublicAccessBlock(name, {
      bucket: this.bucket.id,
      blockPublicAcls: false,
      blockPublicPolicy: false,
      ignorePublicAcls: false,
      restrictPublicBuckets: false,
    });
    const bucketPolicyDocument = this.bucket.arn.apply((arn) => {
      return aws.iam.getPolicyDocument({
        statements: [
          {
            actions: ["s3:GetObject"],
            principals: [{ identifiers: ["*"], type: "AWS" }],
            resources: [`${arn}/*`],
          },
        ],
      });
    });

    const bucketPolicy = new aws.s3.BucketPolicy(
      name,
      {
        bucket: this.bucket.id,
        policy: bucketPolicyDocument.json,
      },
      {
        dependsOn: [allowPublicAccess],
      }
    );

    const homePage = new aws.s3.BucketObject(name, {
      bucket: this.bucket.id,
      source: new pulumi.asset.FileAsset(args.indexFilePath),
      contentType: "text/html",
      contentDisposition: "inline",
      key: "index.html",
    });
    const cloudfrontDistribution = new aws.cloudfront.Distribution(name, {
      enabled: true,
      origins: [
        {
          domainName: this.bucket.bucketRegionalDomainName,
          originId: this.bucket.arn,
        },
      ],
      aliases: [args.domainName],
      defaultRootObject: "index.html",
      defaultCacheBehavior: {
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        targetOriginId: this.bucket.arn,

        cachedMethods: ["GET", "HEAD", "OPTIONS"],
        viewerProtocolPolicy: "allow-all",
        forwardedValues: {
          cookies: { forward: "none" },
          queryString: false,
        },
      },
      viewerCertificate: {
        acmCertificateArn: args.certificateArn,
        sslSupportMethod: "sni-only",
      },
      restrictions: {
        geoRestriction: {
          restrictionType: "none",
        },
      },
    });

    const cloudfrontRecord = new aws.route53.Record(name, {
      name: args.domainName,
      type: "A",
      zoneId: args.zoneId,
      aliases: [
        {
          evaluateTargetHealth: true,
          name: cloudfrontDistribution.domainName,
          zoneId: cloudfrontDistribution.hostedZoneId,
        },
      ],
    });
  }
}
