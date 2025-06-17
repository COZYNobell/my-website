# ~/terraform/modules/rds/variables.tf

variable "identifier" {
  description = "Unique identifier for the RDS instance"
  type        = string
}

variable "instance_class" {
  description = "RDS instance type"
  type        = string
}

variable "storage" {
  description = "Allocated storage in GB"
  type        = number
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_user" {
  description = "Database master username"
  type        = string
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "db_subnet_group" {
  description = "Subnet group name for RDS"
  type        = string
}

variable "security_group_ids" {
  description = "List of security group IDs for the RDS instance"
  type        = list(string)
}

variable "replicate_source_arn" {
  description = "ARN of source DB to replicate from (for CRRR)"
  type        = string
  default     = null
}

variable "multi_az" {
  type        = bool
  description = "Whether to enable Multi-AZ deployment for RDS"
  default     = false
}
