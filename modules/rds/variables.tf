variable "identifier" {
  description = "RDS instance identifier"
  type        = string
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "storage" {
  description = "Allocated storage for RDS"
  type        = number
}

variable "db_name" {
  description = "Initial database name"
  type        = string
}

variable "db_user" {
  description = "Master username"
  type        = string
}

variable "db_password" {
  description = "Master password"
  type        = string
  sensitive   = true
}

variable "db_subnet_group" {
  description = "Subnet group for RDS"
  type        = string
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "multi_az" {
  description = "Whether to enable Multi-AZ"
  type        = bool
}

variable "replicate_source_db" {
  description = "ARN of the source DB instance to replicate (if Read Replica)"
  type        = string
  default     = null
}
