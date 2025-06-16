resource "aws_db_subnet_group" "rds" {
  name       = "${var.name}-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "${var.name}-subnet-group"
  }
}

resource "aws_db_instance" "rds_instance" {
  identifier         = "${var.name}-db"
  allocated_storage  = 20
  engine             = "mysql"
  engine_version     = "8.0"
  instance_class     = "db.t3.micro"
  username           = var.db_username
  password           = var.db_password
  db_name            = var.db_name
  db_subnet_group_name = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [var.security_group_id]

  publicly_accessible = false
  skip_final_snapshot = true
  multi_az            = false

  tags = {
    Name = "${var.name}-rds"
  }
}
