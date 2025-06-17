# ~/terraform/modules/rds/outputs.tf

output "endpoint" {
  description = "RDS endpoint to connect to"
  value       = aws_db_instance.this.endpoint
}

output "arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.this.arn
}

output "identifier" {
  description = "RDS instance identifier"
  value       = aws_db_instance.this.id
}
