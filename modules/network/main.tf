# terraform/modules/network/main.tf

# 1. VPC 생성
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "main-vpc"
  }
}

# 2. 퍼블릭 서브넷 생성
resource "aws_subnet" "public" {
  for_each = toset(var.public_subnet_cidrs)

  vpc_id                = aws_vpc.this.id
  cidr_block            = each.value
  availability_zone     = element(var.availability_zones, index(var.public_subnet_cidrs, each.value))
  map_public_ip_on_launch = true

  tags = {
    Name = "public-subnet-${each.key}"
  }
}

# 3. 프라이빗 서브넷 생성
resource "aws_subnet" "private" {
  for_each = toset(var.private_subnet_cidrs)

  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value
  availability_zone = element(var.availability_zones, index(var.private_subnet_cidrs, each.value))

  tags = {
    Name = "private-subnet-${each.key}"
  }
}

# 4. 인터넷 게이트웨이 및 라우팅 설정
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags = { Name = "main-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = { Name = "public-rt" }
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# 5. RDS를 위한 서브넷 그룹 및 보안 그룹
resource "aws_db_subnet_group" "this" {
  name       = "rds-subnet-group"
  subnet_ids = [for s in aws_subnet.private : s.id]
  tags       = { Name = "rds-subnet-group" }
}

resource "aws_security_group" "rds" {
  name        = "rds-sg"
  description = "Allow MySQL traffic from app servers"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    # 실제 운영 시에는 app_server_sg의 ID를 참조하는 것이 더 안전합니다.
    cidr_blocks     = ["0.0.0.0/0"] 
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "rds-sg" }
}

# 6. ALB를 위한 보안 그룹
resource "aws_security_group" "alb" {
  name        = "alb-sg"
  description = "Allow HTTP traffic from anywhere"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "alb-sg" }
}
