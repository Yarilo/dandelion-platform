echo "Insert username for the first user"
read user

echo "Insert password"
read password

echo "Creating first user"
curl -X POST "http://localhost/api/users/$user?newpass=$password&initial_token=9K7oTnWKWVD3BX06380l74J2c8w857Lf"
