import bcrypt

# The hash from the database
db_hash = b'$2a$12$8OfbPrNDORMOUz81WSPby.Q3LBdYxwmmWQ.sgqaY7RShXgmCEEC8C'

# Test various passwords
passwords_to_test = [
    'admin123',
    'admin',
    'password',
    'admin@123',
    'Admin123',
    '1234',
    'test',
]

print('Testing passwords against database hash:')
print(f'Hash: {db_hash.decode()}')
print()

for pwd in passwords_to_test:
    try:
        result = bcrypt.checkpw(pwd.encode('utf-8'), db_hash)
        if result:
            print(f'✓ Password "{pwd}": MATCH!')
        else:
            print(f'✗ Password "{pwd}": No match')
    except Exception as e:
        print(f'✗ Password "{pwd}": Error - {e}')
