variable "name" {
  description = "이 리소스의 이름 접두사"
  type        = string
}

variable "db_username" {
  description = "DB 관리자 사용자 이름"
  type        = string
}

variable "db_password" {
  description = "DB 비밀번호"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "초기 DB 이름"
  type        = string
}

variable "subnet_ids" {
  description = "RDS용 서브넷 ID 리스트 (Private Subnets)"
  type        = list(string)
}

variable "security_group_id" {
  description = "RDS에 적용할 보안 그룹 ID"
  type        = string
}
