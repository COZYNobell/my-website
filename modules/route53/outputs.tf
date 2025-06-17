# ~/terraform/modules/route53/outputs.tf

output "record_name" {
  description = "The DNS record name"
  value       = aws_route53_record.this.name
}

output "fqdn" {
  description = "Fully qualified domain name of the record"
  # Route 53 zone data source is needed to get the zone name for FQDN
  # For now, we output the record part only.
  value       = aws_route53_record.this.name
}
