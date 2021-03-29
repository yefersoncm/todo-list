// ****** SELECT ITEMS **********
const alert = document.querySelector('.alert1');
const form = document.querySelector('.grocery-form');
const grocery = document.getElementById('grocery');
const submitBtn = document.querySelector('.submit-btn');
const container = document.querySelector('.grocery-container');
const list = document.querySelector('.grocery-list');
const clearBtn = document.querySelector('.clear-btn');

// edit option


let editElement;
let editFlag = false;
let editID = "";

// ****** EVENT LISTENERS **********

//submit form

form.addEventListener('submit', addItem);

//clear items
clearBtn.addEventListener('click', clearItems);
window.addEventListener('DOMContentLoaded', setUpItems);

// ****** FUNCTIONS **********
function markTaskAsDone(e){
  const element = e.currentTarget.parentElement.parentElement;
  element.classList.toggle("done");
  if(element.dataset.done === "false"){
    element.dataset.done = "true";
    displayAlert('tarea marcada como hecha', 'success')
  }else{
    element.dataset.done = "false";
    displayAlert('tarea pendiente', 'warning')
  }

  let items = getLocalStorage();

  items = items.map(function(item){
    if (item.id == element.dataset.id){
      item.done = element.dataset.done;
    }
    return item;
  });

  items.sort(sortLocalStorage('done'));
  localStorage.setItem("list", JSON.stringify(items));

}


function addItem(e){
  e.preventDefault();
  const value = grocery.value;
  const id = new Date().getTime().toString();
  const done = "false";
  if (value && !editFlag) {
    createListItem(id,value,done);
    // display alert
    displayAlert("item agregado a la lista", "success");
    // show container
    container.classList.add("show-container");
    // add to localstorage
    addToLocalStorage(id,value,done);
    // set back to default
    setBackToDefault();
  }else if (value && editFlag) {
    editElement.innerHTML = value;
    displayAlert("valor cambiado", "success");
    //edit local storage
    editLocalStorage(editID, value);
    setBackToDefault();
  } else {
    displayAlert("porfavor ingrese un valor", "danger")
  }
}


function displayAlert(text, action){
  alert.textContent = text;
  alert.classList.add(`alert-${action}`);
  //remove alert
  setTimeout(function(){
    alert.textContent = "";
  alert.classList.remove(`alert-${action}`);
  }, 1000);
}

//clear items
function clearItems(){
  const items = document.querySelectorAll('.grocery-item');

  if (items.length > 0) {
    items.forEach(function(item){
      list.removeChild(item);
    });
  }
  container.classList.remove("show-container");
  displayAlert("lista vacia", "danger");
  localStorage.removeItem('list');
  setBackToDefault();
  //
}

// delete function
function deletiItem(e){
   const element = e.currentTarget.parentElement.parentElement;
   const id = element.dataset.id;
   list.removeChild(element);
   if(list.children.length === 0){
     container.classList.remove("show-container");
   }
   displayAlert("Item eliminado", "danger");
   setBackToDefault();
   removeFromLocalStorage(id);
}

// edit function
function editItem(e){
  const element = e.currentTarget.parentElement.parentElement;
  // set editItem
  editElement = e.currentTarget.parentElement.previousElementSibling;
  // set form value
  grocery.value = editElement.innerHTML;
  editFlag = true;
  editID = element.dataset.id;
  submitBtn .textContent = "Editar";
}
// set back to default
function setBackToDefault(){
  grocery.value="";
  editFlag = false;
  editID = '';
  submitBtn.textContent = "Agregar";
}

// ****** LOCAL STORAGE **********
function addToLocalStorage(id,value,done){
  const grocery = {id,value,done};
  let items = getLocalStorage();
    items.push(grocery);
    items.sort(sortLocalStorage('done'));
    localStorage.setItem('list', JSON.stringify(items));
    console.log(items);

}
function removeFromLocalStorage(id){
  let items = getLocalStorage();
  items.sort(sortLocalStorage('done'));
  items = items.filter(function(item){
    if(item.id !== id){
      return item
    }
  });
  items.sort(sortLocalStorage('done'));
  localStorage.setItem("list", JSON.stringify(items));
}
function editLocalStorage(id, value){
  let items = getLocalStorage();
  items.sort(sortLocalStorage('done'));
  items = items.map(function(item){
    if (item.id == id){
      item.value = value;
    }
    return item;
  });
  items.sort(sortLocalStorage('done'));
  localStorage.setItem("list", JSON.stringify(items));
}
function getLocalStorage(){
  return localStorage.getItem("list")
  ? JSON.parse(localStorage.getItem("list"))
  : [];
}

// localStorage API
// setItem
// getItem
// removeItem
// save as string

// localStorage.setItem('orange', JSON.stringify(["item", "item2"]));
// let oranges = JSON.parse(localStorage.getItem('orange'));

// console.log(oranges);
// localStorage.removeItem('orange');



// ****** SETUP ITEMS **********
function setUpItems(){
  let items = getLocalStorage();
  items.sort(sortLocalStorage('done'));
  if(items.length > 0){
    items.forEach(function(item){
      createListItem(item.id, item.value, item.done);
    });
    container.classList.add('show-container');

  }
}

function createListItem(id, value, done){
  const element = document.createElement('article');
    // add class
    element.classList.add('grocery-item');
    // add id
    const attr = document.createAttribute('data-id');
    const attrDone = document.createAttribute('data-done');
    attr.value = id;
    attrDone.value = done;
    element.setAttributeNode(attr);
    element.setAttributeNode(attrDone);



    element.innerHTML = `<p class="title">${value}</p>
    <div class="btn-container form-check form-switch">
      <input class="form-check-input" type="checkbox">
      <button type="button" class="edit-btn">
        <i class="fas fa-edit"></i>
      </button>
      <button type="button" class="delete-btn">
        <i class="fas fa-trash"></i>
      </button>
    </div>`;
    if(element.dataset.done === "true"){
      element.classList.add('done');
      element.lastChild.children[0].checked = true;
    }else{
      element.classList.remove('done');
      element.lastChild.children[0].checked = false;
    }

    const deleteBtn = element.querySelector('.delete-btn');
    const editBtn = element.querySelector('.edit-btn');
    const checkboxBtn = element.querySelector('.form-check-input');
    deleteBtn.addEventListener('click', deletiItem);
    editBtn.addEventListener('click', editItem);
    checkboxBtn.addEventListener('change', markTaskAsDone);
    //append child
    list.appendChild(element);

}

function editLocalStorageDone(id, done){
  let items = getLocalStorage();
  items.sort(sortLocalStorage('done'));
  items = items.map(function(item){
    if (item.id === id){
      item.done = done;
    }
    return item;
  });
  localStorage.setItem("list", JSON.stringify(items));
}

function sortLocalStorage(atributo) {
    return function(a, b) {
        if (a[atributo] > b[atributo]) {
            return 1;
        } else if (a[atributo] < b[atributo]) {
            return -1;
        }
        return 0;
    }
}
