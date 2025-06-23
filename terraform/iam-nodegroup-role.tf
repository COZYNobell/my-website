resource "aws_iam_role" "alpha_node_role" {
  name = "alpha-eks-node-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = {
        Service = "ec2.amazonaws.com"
      },
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "alpha_worker_node_AmazonEKSWorkerNodePolicy" {
  role       = aws_iam_role.alpha_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "alpha_worker_node_AmazonEC2ContainerRegistryReadOnly" {
  role       = aws_iam_role.alpha_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "alpha_worker_node_AmazonEKS_CNI_Policy" {
  role       = aws_iam_role.alpha_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}
