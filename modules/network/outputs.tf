# terraform/modules/network/outputs.tf

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.this.id
}

output "public_subnets" {
  description = "List of IDs for the public subnets"
  value       = [for s in aws_subnet.public : s.id]
}

output "private_subnet_group" {
  description = "The name of the DB Subnet Group"
  value       = aws_db_subnet_group.this.name
}

output "rds_sg_id" {
  description = "The ID of the security group for RDS"
  value       = aws_security_group.rds.id
}

output "alb_sg_id" {
  description = "The ID of the security group for the ALB"
  value       = aws_security_group.alb.id
}
