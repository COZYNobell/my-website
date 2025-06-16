output "alb_dns_name" {
  value       = aws_lb.this.dns_name
  description = "DNS name of the ALB"
}

output "alb_zone_id" {
  value       = aws_lb.this.zone_id
  description = "Route53 alias target zone ID"
}
