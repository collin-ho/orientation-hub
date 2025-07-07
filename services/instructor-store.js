const db = require('./db');

function dbRowToInstructor(r){
  return {
    id: r.id,
    name: r.name,
    email: r.email || undefined,
    role: r.role || undefined,
    status: r.status || undefined,
  };
}

function instructorToParams(u){
  return {
    id: String(u.id),
    name: u.name,
    email: u.email || null,
    role: u.role || null,
    status: u.status || null,
  };
}

function getAllInstructors(){
  return db.prepare('SELECT * FROM instructors ORDER BY name').all().map(dbRowToInstructor);
}

function replaceAllInstructors(list){
  const ins = db.prepare('INSERT OR REPLACE INTO instructors (id,name,email,role,status) VALUES (@id,@name,@email,@role,@status)');
  const trx = db.transaction((arr)=>{
    db.prepare('DELETE FROM instructors').run();
    arr.forEach(u=>ins.run(instructorToParams(u)));
  });
  trx(list);
}

module.exports={getAllInstructors,replaceAllInstructors}; 