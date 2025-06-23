resource "aws_iam_policy" "externaldns_policy" {
  name        = "ExternalDNSAccessPolicy"
  description = "Allow ExternalDNS to manage Route53 records"
  policy      = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "route53:ChangeResourceRecordSets",
          "route53:ListHostedZones",
          "route53:ListResourceRecordSets"
        ]
        Resource = "*"
      }
    ]
  })
}

module "irsa_externaldns_seoul" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"

  create_role                   = true
  role_name                     = "externaldns-seoul-irsa"
  provider_url                  = module.eks_seoul.oidc_provider
  oidc_fully_qualified_subjects = ["system:serviceaccount:kube-system:external-dns"]

  role_policy_arns = [aws_iam_policy.externaldns_policy.arn]
}

module "irsa_externaldns_tokyo" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"

  create_role                   = true
  role_name                     = "externaldns-tokyo-irsa"
  provider_url                  = module.eks_tokyo.oidc_provider
  oidc_fully_qualified_subjects = ["system:serviceaccount:kube-system:external-dns"]

  role_policy_arns = [aws_iam_policy.externaldns_policy.arn]
}
