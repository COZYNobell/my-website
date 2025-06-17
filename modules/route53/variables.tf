# ~/terraform/modules/route53/variables.tf

variable "zone_id" {
  type        = string
  description = "The Route53 Hosted Zone ID"
}

variable "record_name" {
  type        = string
  description = "The name of the DNS record to create (e.g., db.myapp.com)"
}

variable "cname_value" {
  type        = string
  description = "The value of the CNAME record (e.g., RDS endpoint)"
}
