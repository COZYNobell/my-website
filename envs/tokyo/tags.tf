resource "aws_ec2_tag" "tokyo_vpc_cluster_tag" {
  resource_id = "vpc-0631eaad6a10ddfee"
  key         = "kubernetes.io/cluster/alpha-eks-tokyo"
  value       = "shared"
}

resource "aws_ec2_tag" "tokyo_public_subnet_tag" {
  resource_id = "rtb-023cfce57ba2181ca"
  key         = "kubernetes.io/role/elb"
  value       = "1"
}

resource "aws_ec2_tag" "tokyo_private_subnet_tag" {
  resource_id = "rtb-0d1373095a7dd3aa0"
  key         = "kubernetes.io/role/internal-elb"
  value       = "1"
}
