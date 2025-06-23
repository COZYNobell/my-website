output "cname_record" {
  value = aws_route53_record.cname.fqdn
}
