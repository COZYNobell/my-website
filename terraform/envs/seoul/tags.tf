resource "aws_ec2_tag" "seoul_vpc_cluster_tag" {
  resource_id = "vpc-01dc2534a77a00126"
  key         = "kubernetes.io/cluster/alpha-eks-seoul"
  value       = "shared"
}

resource "aws_ec2_tag" "seoul_public_subnet_tag" {
  resource_id = "rtb-00eef432a2da9e2b2"
  key         = "kubernetes.io/role/elb"
  value       = "1"
}

resource "aws_ec2_tag" "seoul_private_subnet_tag" {
  resource_id = "rtb-0d5184de1e7874f8a"
  key         = "kubernetes.io/role/internal-elb"
  value       = "1"
}
