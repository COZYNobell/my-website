output "route53_record_name" {
  description = "The DNS record name"
  value       = aws_route53_record.weather_app.name
}

output "route53_record_fqdn" {
  description = "The full domain name"
  value       = "${aws_route53_record.weather_app.name}.${var.route53_zone_id}"
}
