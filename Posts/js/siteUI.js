////// Author: Nicolas Chourot
////// 2024
//////////////////////////////

const periodicRefreshPeriod = 2;
const waitingGifTrigger = 2000;
const minKeywordLenth = 3;
const keywordsOnchangeDelay = 500;

let categories = [];
let selectedCategory = "";
let currentETag = "";
let currentPostsCount = -1;
let periodic_Refresh_paused = false;
let postsPanel;
let itemLayout;
let waiting = null;
let showKeywords = false;
let keywordsOnchangeTimger = null;
sessionStorage.setItem("messageCode", " ");
initTimeout(15,() => showLogin());
Init_UI();
async function Init_UI() {
    postsPanel = new PageManager('postsScrollPanel', 'postsPanel', 'postSample', renderPosts);
    $('#createPost').on("click", async function () {
        showCreatePostForm();
    });
    $('#abort').on("click", async function () {
        showPosts();
    });
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $("#showSearch").on('click', function () {
        toogleShowKeywords();
        showPosts();
    });

    installKeywordsOnkeyupEvent();
    await showPosts();
    start_Periodic_Refresh();
}

/////////////////////////// Search keywords UI //////////////////////////////////////////////////////////

function installKeywordsOnkeyupEvent() {

    $("#searchKeys").on('keyup', function () {
        clearTimeout(keywordsOnchangeTimger);
        keywordsOnchangeTimger = setTimeout(() => {
            cleanSearchKeywords();
            showPosts(true);
        }, keywordsOnchangeDelay);
    });
    $("#searchKeys").on('search', function () {
        showPosts(true);
    });
}
function cleanSearchKeywords() {
    /* Keep only keywords of 3 characters or more */
    let keywords = $("#searchKeys").val().trim().split(' ');
    let cleanedKeywords = "";
    keywords.forEach(keyword => {
        if (keyword.length >= minKeywordLenth) cleanedKeywords += keyword + " ";
    });
    $("#searchKeys").val(cleanedKeywords.trim());
}
function showSearchIcon() {
    $("#hiddenIcon").hide();
    $("#showSearch").show();
    if (showKeywords) {
        $("#searchKeys").show();
    }
    else
        $("#searchKeys").hide();
}
function hideSearchIcon() {
    $("#hiddenIcon").show();
    $("#showSearch").hide();
    $("#searchKeys").hide();
}
function toogleShowKeywords() {
    showKeywords = !showKeywords;
    if (showKeywords) {
        $("#searchKeys").show();
        $("#searchKeys").focus();
    }
    else {
        $("#searchKeys").hide();
        showPosts(true);
    }
}

/////////////////////////// Views management ////////////////////////////////////////////////////////////

function intialView() {
    $("#createPost").show();
    $("#hiddenIcon").hide();
    $("#hiddenIcon2").hide();
    $('#menu').show();
    $('#commit').hide();
    $('#abort').hide();
    $('#form').hide();
    $('#form').empty();
    $('#aboutContainer').hide();
    $('#errorContainer').hide();
    showSearchIcon();
}
async function showPosts(reset = false) {
    intialView();
    let user = JSON.parse(sessionStorage.getItem("User"));
    if(user != null)
    {
        if(user.isSuper || user.isAdmin)
        {
            $('#createPost').show();
        }
    }
    else
    {
        $('#createPost').hide();
    }
    $("#viewTitle").text("Fil de nouvelles");
    periodic_Refresh_paused = false;
    await postsPanel.show(reset);
}
function hidePosts() {
    postsPanel.hide();
    hideSearchIcon();
    $("#createPost").hide();
    $('#menu').hide();
    periodic_Refresh_paused = true;
}
function showForm() {
    hidePosts();
    $('#form').show();
    $('#commit').show();
    $('#abort').show();
}
function showError(message, details = "") {
    hidePosts();
    $('#form').hide();
    $('#form').empty();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#commit').hide();
    $('#abort').show();
    $("#viewTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").empty();
    $("#errorContainer").append($(`<div>${message}</div>`));
    $("#errorContainer").append($(`<div>${details}</div>`));
}

function showCreatePostForm() {
    showForm();
    $("#viewTitle").text("Ajout de nouvelle");
    renderPostForm();
}
function showEditPostForm(id) {
    showForm();
    $("#viewTitle").text("Modification");
    renderEditPostForm(id);
}
function showDeletePostForm(id) {
    showForm();
    $("#viewTitle").text("Retrait");
    renderDeletePostForm(id);
}
function showLogin() {
    showForm();
    renderLoginForm();
}
function showConfirmLogin() {
    showForm();
    renderLoginConfirm();
}
function showEditUser() {
    showForm();
    renderEditAccountForm();
    
}
function showUserManager() {
    showForm();
    renderUserManager();
}
function showAbout() {
    hidePosts();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#abort').show();
    $("#viewTitle").text("À propos...");
    $("#aboutContainer").show();
}

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

function start_Periodic_Refresh() {
    $("#reloadPosts").addClass('white');
    $("#reloadPosts").on('click', async function () {
        $("#reloadPosts").addClass('white');
        postsPanel.resetScrollPosition();
        await showPosts();
    })
    setInterval(async () => {
        if (!periodic_Refresh_paused) {
            let etag = await Posts_API.HEAD();
            // the etag contain the number of model records in the following form
            // xxx-etag
            let postsCount = parseInt(etag.split("-")[0]);
            if (currentETag != etag) {
                if (postsCount != currentPostsCount) {
                    console.log("postsCount", postsCount)
                    currentPostsCount = postsCount;
                    $("#reloadPosts").removeClass('white');
                } else
                    await showPosts();
                currentETag = etag;
            }
        }
    },
        periodicRefreshPeriod * 1000);
}
async function renderPosts(queryString) {
    timeout(120);
    let endOfData = false;
    queryString += "&sort=date,desc";
    compileCategories();
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    if (showKeywords) {
        let keys = $("#searchKeys").val().replace(/[ ]/g, ',');
        if (keys !== "")
            queryString += "&keywords=" + $("#searchKeys").val().replace(/[ ]/g, ',')
    }
    addWaitingGif();
    let response = await Posts_API.Get(queryString);
    if (!Posts_API.error) {
        currentETag = response.ETag;
        currentPostsCount = parseInt(currentETag.split("-")[0]);
        let Posts = response.data;
        if (Posts.length > 0) {
            Posts.forEach(Post => {
                postsPanel.append(renderPost(Post));
            });
        } else
            endOfData = true;
        linefeeds_to_Html_br(".postText");
        highlightKeywords();
        attach_Posts_UI_Events_Callback();
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}
function renderPost(post, loggedUser) {
    let date = convertToFrenchDate(UTC_To_Local(post.Date));
    let crudIcon = " ";
    let LikeIcon = " ";
    let user = JSON.parse(sessionStorage.getItem("User"));
    console.log(user);
    if(user != null)
    {
        //$("#nbLikes").text(nblikes);
        LikeIcon = `
            <p class="fa-regular fa-thumbs-up likeCmd" postId="${post.Id}" ></p>
            <p id="nbLikes-${post.Id}" class="nbLikes"></p>
        `;
        if (user.isSuper || user.isAdmin) {
            crudIcon =
            `
            <span class="editCmd cmdIconSmall fa fa-pencil" postId="${post.Id}" title="Modifier nouvelle"></span>
            <span class="deleteCmd cmdIconSmall fa fa-trash" postId="${post.Id}" title="Effacer nouvelle"></span>
            `;
        }
    }
    return $(`
        <div class="post" id="${post.Id}">
            <div class="postHeader">
                ${post.Category}
                ${crudIcon}
                ${LikeIcon}
            </div>
            <div class="postTitle"> ${post.Title} </div>
            <img class="postImage" src='${post.Image}'/>
            <div class"UserInfoPosts">
                <img class="userProfileImage" src='${post.UserAvatar}'/>
                <div class="userName">${post.UserName}</div>
                <div class="postDate"> ${date} </div>
            </div>
            
            <div postId="${post.Id}" class="postTextContainer hideExtra">
                <div class="postText" >${post.Text}</div>
            </div>
            <div class="postfooter">
                <span postId="${post.Id}" class="moreText cmdIconXSmall fa fa-angle-double-down" title="Afficher la suite"></span>
                <span postId="${post.Id}" class="lessText cmdIconXSmall fa fa-angle-double-up" title="Réduire..."></span>
            </div>         
        </div>
    `);
}
async function compileCategories() {
    categories = [];
    let response = await Posts_API.GetQuery("?fields=category&sort=category");
    if (!Posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            if (!categories.includes(selectedCategory))
                selectedCategory = "";
            updateDropDownMenu(categories);
        }
    }
}
function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();

    let user = JSON.parse(sessionStorage.getItem("User"));
    
    if (user != null && user != undefined) {
        // Ajouter l'image et le nom de l'utilisateur connecté
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="userProfileCmd">
                <img src="${user.Avatar}" alt="${user.Name}" class="userProfileImage" />
                <span class="userName">${user.Name}</span>
            </div>
        `));
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="userEditCmd">
                <i class="menuIcon fa-solid fa-user-pen"></i> Modifier votre profil
            </div>
        `));
    }
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="userManagerCmd">
            <i class="menuIcon fa fa-user-gear mx-2"></i> Gestion d'usagers
        </div>
    `));
    DDMenu.append($(`
        <div class="dropdown-divider"></div>
    `));
    user = JSON.parse(sessionStorage.getItem("User"));
    if(user == null || user == undefined)
    {
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="loginCmd">
                <i class="menuIcon fa fa-right-to-bracket mx-2"></i> Se Connecter
            </div>
        `));
    }
    else
    {
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="logoutCmd">
                <i class="menuIcon fa fa-right-to-bracket mx-2"></i> Se Déconnecter
            </div>
        `));
    }
    
    DDMenu.append($(`
            <div class="dropdown-divider"></div>
        `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `));
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $('#userManagerCmd').on("click", function () {
        showUserManager();
    });
    $('#loginCmd').on("click", function () {
        showLogin();
    });
    $('#userEditCmd').on("click", function () {
        showEditUser();
    });
    $('#logoutCmd').on("click", async function () {
        let user = JSON.parse(sessionStorage.getItem("User"));
        console.log(user);
        users_API.Logout(user.Id);
        sessionStorage.removeItem("User");
        sessionStorage.removeItem("token");
        showLogin();
    })
    $('#allCatCmd').on("click", async function () {
        selectedCategory = "";
        await showPosts(true);
        updateDropDownMenu();
    });
    $('.category').on("click", async function () {
        selectedCategory = $(this).text().trim();
        await showPosts(true);
        updateDropDownMenu();
    });
}
async function attach_Posts_UI_Events_Callback() {

    linefeeds_to_Html_br(".postText");

        // Récupérer tous les likes et les appliquer correctement à chaque post
        let likes = await users_API.getAllLike();
        let user = JSON.parse(sessionStorage.getItem("User"));
        if(user != null)
        {
            $(".post").each(function () {
                let postId = $(this).attr("id");  // Assurez-vous que l'ID du post est bien attribué
                let nblikes = likes.filter(like => like.idPost == postId).length;
                $(`#nbLikes-${postId}`).text(nblikes);  // Mettre à jour le compteur de likes
        
                // Vérifier si l'utilisateur a déjà liké ce post
                let likedByUser = likes.some(like => like.idPost == postId && like.UserName == user.Name);
                
                // Appliquer la bonne classe (fa-solid si l'utilisateur a liké, sinon fa-regular)
                if (likedByUser) {
                    $(`.likeCmd[postId=${postId}]`).removeClass("fa-regular").addClass("fa-solid");
                } else {
                    $(`.likeCmd[postId=${postId}]`).removeClass("fa-solid").addClass("fa-regular");
                }
        
                // Afficher les noms des utilisateurs au survol du nombre de likes
                $(`#nbLikes-${postId}`).on("mouseenter", function () {
                    let likedUsers = likes.filter(like => like.idPost == postId).map(like => like.UserName);
                    // Créer une chaîne de texte avec les noms des utilisateurs
                    let userList = likedUsers.join(', ');
        
                    // Afficher les utilisateurs dans une info-bulle ou une boîte de texte
                    $(this).attr("title", `Liked by: ${userList}`);  // Utiliser l'attribut title pour afficher le tooltip
                });
        
                $(`#nbLikes-${postId}`).on("mouseleave", function () {
                    $(this).removeAttr("title");  // Retirer le tooltip au départ de la souris
                });
            });
        }
        // Mettre à jour le nombre de likes et la classe pour chaque post
        

    // attach icon command click event callback
    $(".editCmd").off();
    $(".editCmd").on("click", function () {
        showEditPostForm($(this).attr("postId"));
    });
    $(".likeCmd").off();
    $(".likeCmd").on("click", async function () {
        let user = JSON.parse(sessionStorage.getItem("User"));
        let postId = $(this).attr("postId");
        let data = {
            idPost: postId,
            UserName: user.Name
        };
    
        // Ajout ou suppression du like
        if ($(this).hasClass("fa-regular")) {
            $(this).removeClass("fa-regular").addClass("fa-solid");
            await users_API.Like(data);
        } else {
            $(this).removeClass("fa-solid").addClass("fa-regular");
            let likes = await users_API.getAllLike();
            for (let element of likes) {
                if (element.idPost == postId && element.UserName == user.Name) {
                    await users_API.Unlike(element.Id);
                    break;
                }
            }
        }
    
        // Récupérer et mettre à jour le nombre de likes pour ce post
        let likes = await users_API.getAllLike();
        let nblikes = likes.filter(element => element.idPost == postId).length;
        $(`#nbLikes-${postId}`).text(nblikes); // Met à jour le compteur unique
    });
    

    $(".deleteCmd").off();
    $(".deleteCmd").on("click", function () {
        showDeletePostForm($(this).attr("postId"));
    });
    $(".moreText").off();
    $(".moreText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).show();
        $(`.lessText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('showExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('hideExtra');
    })
    $(".lessText").off();
    $(".lessText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).hide();
        $(`.moreText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        postsPanel.scrollToElem($(this).attr("postId"));
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('hideExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('showExtra');
    })
}
function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        postsPanel.itemsPanel.append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

/////////////////////// Posts content manipulation ///////////////////////////////////////////////////////

function linefeeds_to_Html_br(selector) {
    $.each($(selector), function () {
        let postText = $(this);
        var str = postText.html();
        var regex = /[\r\n]/g;
        postText.html(str.replace(regex, "<br>"));
    })
}
function highlight(text, elem) {
    text = text.trim();
    if (text.length >= minKeywordLenth) {
        var innerHTML = elem.innerHTML;
        let startIndex = 0;

        while (startIndex < innerHTML.length) {
            var normalizedHtml = innerHTML.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var index = normalizedHtml.indexOf(text, startIndex);
            let highLightedText = "";
            if (index >= startIndex) {
                highLightedText = "<span class='highlight'>" + innerHTML.substring(index, index + text.length) + "</span>";
                innerHTML = innerHTML.substring(0, index) + highLightedText + innerHTML.substring(index + text.length);
                startIndex = index + highLightedText.length + 1;
            } else
                startIndex = innerHTML.length + 1;
        }
        elem.innerHTML = innerHTML;
    }
}
function highlightKeywords() {
    if (showKeywords) {
        let keywords = $("#searchKeys").val().split(' ');
        if (keywords.length > 0) {
            keywords.forEach(key => {
                let titles = document.getElementsByClassName('postTitle');
                Array.from(titles).forEach(title => {
                    highlight(key, title);
                })
                let texts = document.getElementsByClassName('postText');
                Array.from(texts).forEach(text => {
                    highlight(key, text);
                })
            })
        }
    }
}

//////////////////////// Forms rendering /////////////////////////////////////////////////////////////////

async function renderEditPostForm(id) {
    noTimeout();
    $('#commit').show();
    addWaitingGif();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null)
            renderPostForm(Post);
        else
            showError("Post introuvable!");
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletePostForm(id) {
    timeout(60);
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let post = response.data;
        if (post !== null) {
            let date = convertToFrenchDate(UTC_To_Local(post.Date));
            $("#form").append(`
                <div class="post" id="${post.Id}">
                <div class="postHeader">  ${post.Category} </div>
                <div class="postTitle ellipsis"> ${post.Title} </div>
                <img class="postImage" src='${post.Image}'/>
                <div class="postDate"> ${date} </div>
                <div class="postTextContainer showExtra">
                    <div class="postText">${post.Text}</div>
                </div>
            `);
            linefeeds_to_Html_br(".postText");
            // attach form buttons click event callback
            $('#commit').on("click", async function () {
                await Posts_API.Delete(post.Id);
                if (!Posts_API.error) {
                    await showPosts();
                }
                else {
                    console.log(Posts_API.currentHttpError)
                    showError("Une erreur est survenue!");
                }
            });
            $('#cancel').on("click", async function () {
                await showPosts();
            });

        } else {
            showError("Post introuvable!");
        }
    } else
        showError(Posts_API.currentHttpError);
}
function newPost() {
    let Post = {};
    Post.Id = 0;
    Post.Title = "";
    Post.Text = "";
    Post.Image = "news-logo-upload.png";
    Post.Category = "";
    return Post;
}
function renderPostForm(post = null) {
    noTimeout();
    let create = post == null;
    if (create) post = newPost();
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${post.Id}"/>
             <input type="hidden" name="Date" value="${post.Date}"/>
            <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${post.Category}"
            />
            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${post.Title}"
            />
            <label for="Url" class="form-label">Texte</label>
             <textarea class="form-control" 
                          name="Text" 
                          id="Text"
                          placeholder="Texte" 
                          rows="9"
                          required 
                          RequireMessage = 'Veuillez entrer une Description'>${post.Text}</textarea>

            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='${create}' 
                     controlId='Image' 
                     imageSrc='${post.Image}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de création </label>
            </div>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary displayNone">
        </form>
    `);
    if (create) $("#keepDateControl").hide();

    initImageUploaders();
    initFormValidation(); // important do to after all html injection!

    $("#commit").click(function () {
        $("#commit").off();
        return $('#savePost').trigger("click");
    });
    $('#postForm').on("submit", async function (event) {
        event.preventDefault();
        let post = getFormData($("#postForm"));
        if (post.Category != selectedCategory)
            selectedCategory = "";
        if (create || !('keepDate' in post))
            post.Date = Local_to_UTC(Date.now());
        if(create){
            let user = JSON.parse(sessionStorage.getItem("User"));
            //let avatar = user.Avatar.replace("http://localhost:5000/assetsRepository/","User");
            post.UserAvatar = user.Avatar;
            post.UserId = user.Id;
            post.UserName = user.Name;
        }
        delete post.keepDate;
        post = await Posts_API.Save(post, create);
        if (!Posts_API.error) {
            await showPosts();
            postsPanel.scrollToElem(post.Id);
        }
        else
            showError("Une erreur est survenue! ", Posts_API.currentHttpError);
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });
}
function renderLoginForm() {
    noTimeout();
    $("#viewTitle").text("Connexion");
    $("#form").show();
    $("#form").empty();
    $("#form").append($(`
        <form class="loginForm">
            <p id="message">${sessionStorage.getItem("messageCode")}</p>
            <div class="form-section">
                <input type="text" id="Email" placeholder="Courriel" name="Email" required RequireMessage="Veuillez entrer un courriel" class="textInput"/>
                <input type="password" id="Password" placeholder="Mot de Passe" name="Password" required RequireMessage="Veuillez entrer le mot de passe" class="textInput"/>
            </div>
            <div class="form-submit-section">
                <input type="submit" value="Entrer" id="commitLogin" class="btn btn-primary"/>
                <hr/>
                <input type="submit"value="Nouveau Compte" id="createAccount" class="btn btn-secondary newAccountBtn"/>
            </div>
            <p id="errorMessage" style="color: red; display: none;"></p>
        </form>
    `));
    initFormValidation(); // important do to after all html injection!
    sessionStorage.setItem("messageCode", " ");
    $('#createAccount').on("click", function () {
        renderCreateAccountForm();
    });
    $('#commitLogin').on("click", async function (e) {
        e.preventDefault();
        let loginInfo = getFormData($(".loginForm"));
        console.log(loginInfo);
        //periodic_Refresh_paused = false;
        try {
            let user = await users_API.Login(loginInfo);
    
            if (user != null) {
                if(!user.User.isBlocked)
                {
                    if (user.User.VerifyCode !== "verified") {
                        //sessionStorage.setItem("tokenTempo", user.Access_token);
                        sessionStorage.setItem("UserIdTempo", user.User.Id);
                        sessionStorage.setItem("Email", loginInfo.Email);
                        sessionStorage.setItem("Password", loginInfo.Password);
                        await users_API.Logout(user.User.Id);
                        timeout(120);
                        showConfirmLogin();
                    } else {
                        sessionStorage.setItem("token", user.Access_token);
                        sessionStorage.setItem("User", JSON.stringify(user.User));
                        timeout(120);
                        showPosts();
                    }
                }
                else {
                    $("#errorMessage").text("Votre compte à été bloquer!").show();
                }
                
            } else {
                //console.log(users_API.currentHttpError);
                // Si `users_API.Login` retourne null, afficher un message d'erreur générique
                $("#errorMessage").text(users_API.currentHttpError).show();
            }
        } catch (error) {
            // Gérer l'erreur si elle est retournée par `users_API.Login`
            console.log("Erreur détectée :", error);
    
            // Vérifiez si l'erreur contient des informations exploitables
            if (error.response && error.response.data) {
                const errorMessage = error.response.data.message || "Une erreur inconnue s'est produite.";
                showError(errorMessage);
            } else {
                showError("Impossible de traiter votre demande pour le moment.");
            }
        }
    });
}
function renderLoginConfirm() {
    //console.log(test);
    //periodic_Refresh_paused = false;
    //let user = await users_API.Login(loginInfo);
        //await users_API.Logout(sessionStorage.getItem("UserTempo").User.Id);
        $("#viewTitle").text("Confirmation de compte");
        $("#form").show();
        $("#form").empty();
        $("#form").append($(`
        <form class="ConfirmationForm">
            <div class="form-section">
                <input type="text" id="Code" placeholder="Code de confirmation" name="Code" required RequireMessage="Veuillez entrer le code de confirmation" class="textInput"/>
            </div>
            <div class="form-submit-section">
                <input type="submit" value="Confirmation" id="confirmeLogin" class="btn btn-primary"/>
            </div>
            <p id="errorMessage" style="color: red; display: none;"></p>
        </form>
        `));
        initFormValidation();
        $('#confirmeLogin').on("click",async function (e) {
            e.preventDefault();
            let code = getFormData($(".ConfirmationForm"));
            let userId = sessionStorage.getItem("UserIdTempo");
            console.log(userId);
            let result = await users_API.ConfirmationUser(userId,code.Code);
            if(result)
            {
                let data = {
                    Email :sessionStorage.getItem("Email"),
                    Password : sessionStorage.getItem("Password")
                }
                console.log(data);
                let user = await users_API.Login(data);
                sessionStorage.setItem("token", user.Access_token);
                sessionStorage.setItem("User", JSON.stringify(user.User));
                timeout(300);
                showPosts();
            }
            else
            {
                $("#errorMessage").text(users_API.currentHttpError).show();
            }
        });
}
function renderCreateAccountForm() {
    noTimeout();
    $("#viewTitle").text("Créer un Compte");
    $("#form").show().empty();

    // Ajout du formulaire HTML
    $("#form").append($(` 
        <form class="createAccountForm">
            <div class="form-section">
                <span>Adresse Courriel</span>
                <input type="text" class="Email textInput" id="Email" placeholder="Courriel" name="Email" required RequireMessage="Veuillez entrer un courriel"/>
                <input type="text" class="Email textInput" id="EmailVerification" placeholder="Vérification" name="EmailVerification" required matchedInputId="Email" RequireMessage="Veuillez confirmer le courriel" class="textInput"/>
            </div>
            <div class="form-section">
                <span>Mot de Passe</span>
                <input type="password" id="Password" placeholder="Mot de passe" name="Password" required RequireMessage="Veuillez entrer un mot de passe" class="textInput"/>
                <input type="password" class="textInput" id="PasswordVerification" placeholder="Vérification" name="PasswordVerification" required matchedInputId="Password" RequireMessage="Veuillez confirmer le mot de passe" class="textInput"/>
            </div>
            <div class="form-section">
                <span>Nom</span>
                <input type="text" id="Username" placeholder="Nom" name="Username" required RequireMessage="Veuillez entrer un nom" class="textInput"/>
            </div>
            <div class="form-section">
                <span>Avatar</span>
                <div class='imageUploaderContainer'>
                    <div class='imageUploader form-section-image' 
                            newImage='./no-avatar.png' 
                            controlId='Image' 
                            imageSrc='./no-avatar.png' 
                            waitingImage="Loading_icon.gif">
                    </div>
                </div>
            </div>
            <div class="form-submit-section">
                <input type="submit" value="Enregistrer" id="commitUser" class="btn btn-primary"/>
                <input type="button" value="Annuler" id="cancel" class="btn btn-secondary"/>
            </div>
            <p id="errorMessage" style="color: red; display: none;"></p>
        </form>
    `));

    // Initialisation des fonctionnalités
    initFormValidation(); // Validation regex et comportement
    //addConflictValidation('/api/check-email', 'Email', 'commitUser'); // Validation d'unicité des emails
    initImageUploaders(); // Gestion de l'upload d'avatar

    // Gestion du bouton "Annuler"
    $('#cancel').on("click", function () {
        renderLoginForm();
    });

    // Gestion du bouton "Enregistrer"
    $('#commitUser').on("click", async function (e) {
        e.preventDefault(); // Empêche le rechargement de la page

        // Validation des champs (mot de passe et e-mail)
        let password = $("#Password").val();
        let passwordVerification = $("#PasswordVerification").val();
        let email = $("#Email").val();
        let emailVerification = $("#EmailVerification").val();
        console.log(password);
        console.log(passwordVerification);
        if (password !== passwordVerification) {
            $("#errorMessage").text("Les mots de passe doivent être identique").show();
            return;
        }
        if (email !== emailVerification) {
            $("#errorMessage").text("Les Email doivent être identique").show();
            return;
        }

        // Récupération des données du formulaire
        let name = $("#Username").val();
        let post = getFormData($(".createAccountForm"));
        let userObject = {
            Id: 0,
            Name: name,
            Password: password,
            Email: email,
            Avatar: post.Image
        };
        if (name == undefined || name == null || name == " " || name == "") {
            $("#errorMessage").text("Nom obligatoire").show();
            return;
        }
        if(post.Image == undefined || post.Image == null || post.Image == " " || post.Image == " ")
        {
            $("#errorMessage").text("Photo de profil obligatoire").show();
            return;
        }
        let response = await users_API.Register(userObject); // Enregistrement de l'utilisateur
        if (response != null) {
            //alert("Compte créé avec succès !");
            sessionStorage.setItem("messageCode", "Votre compte à été créé. Veuillez prendre vos courriels pour réccupérer votre code de vérifivation qui vous sera demandé lors de votre prochaine connexion.");
            renderLoginForm(); // Redirection vers le formulaire de connexion
        }
        else {
            $("#errorMessage").text(users_API.currentHttpError).show();
        }
    });
}
function renderConfirmDelete(id){
    timeout(60);
    $("#viewTitle").text("Confirmation de compte");
        $("#form").show();
        $("#form").empty();
        $("#form").append($(`
        <form class="ConfirmationForm">
            <div class="form-submit-section">
                <input type="button" value="Supprimer" id="delUser" class="btn btn-primary"/>
                <input type="button" value="Annuler" id="cancel" class="btn btn-secondary"/>
            </div>
        </form>
        `));
        $('#delUser').on("click", async function () {
            let user = JSON.parse(sessionStorage.getItem("User"));
            let posts = await Posts_API.Get();
            //console.log(posts.data);
            let likes = await users_API.getAllLike();
            likes.forEach(elem => {
                	if(elem.idUser == user.Id)
                    {
                        users_API.Unlike(elem.Id);
                    }
            });
            posts.data.forEach(element => {
                if(element.UserId==user.Id)
                {
                    Posts_API.Delete(element.Id);
                }
            });
            await users_API.Delete(user.Id);
            sessionStorage.removeItem("User");
            sessionStorage.removeItem("token");
            showLogin();
        });
        $('#cancel').on("click", function () {
            showEditUser();
        });
}
function renderEditAccountForm() {
    noTimeout();
    $("#viewTitle").text("Créer un Compte");
    $("#form").show().empty();
    let user = JSON.parse(sessionStorage.getItem("User"));
    // Ajout du formulaire HTML
    $("#form").append($(`
        <form class="createAccountForm">
            <div class="form-section">
                <span>Adresse Courriel</span>
                <input type="text" value="${user.Email}" class="Email textInput" id="Email" placeholder="Courriel" name="Email" required RequireMessage="Veuillez entrer un courriel" class="textInput"/>
                <input type="text" value="${user.Email}" class="Email textInput" id="EmailVerification" placeholder="Vérification" name="EmailVerification" required matchedInputId="Email" RequireMessage="Veuillez confirmer le courriel" class="textInput"/>
            </div>
            <div class="form-section">
                <span>Mot de Passe (optionel)</span>
                <input type="password" id="Password" placeholder="Mot de passe" name="Password" required RequireMessage="Veuillez entrer un mot de passe" class="textInput"/>
                <input type="password" class="textInput" id="PasswordVerification" placeholder="Vérification" name="PasswordVerification" required matchedInputId="Password" RequireMessage="Veuillez confirmer le mot de passe" class="textInput"/>
            </div>
            <div class="form-section">
                <span>Nom</span>
                <input type="text" value="${user.Name}" id="Username" placeholder="Nom" name="Username" required RequireMessage="Veuillez entrer un nom" class="textInput"/>
            </div>
            <div class="form-section">
                <span>Avatar</span>
                <div class='imageUploaderContainer'>
                    <div class='imageUploader form-section-image' 
                            newImage='./no-avatar.png' 
                            controlId='Image' 
                            imageSrc='${user.Avatar}' 
                            waitingImage="Loading_icon.gif">
                    </div>
                </div>
            </div>
            <div class="form-submit-section">
                <input type="submit" value="Enregistrer" id="EditUser" class="btn btn-primary"/>
                <input type="button" value="Supprimer?" id="del" class="btn btn-secondary"/>
            </div>
            <p id="errorMessage" style="color: red; display: none;"></p>
        </form>
    `));
    initFormValidation(); // Validation regex et comportement
    //addConflictValidation('/api/check-email', 'Email', 'commitUser'); // Validation d'unicité des emails
    initImageUploaders();
    $('#del').on("click", function () {
        renderConfirmDelete(user.Id);
    });
    $('#EditUser').on("click", async function (e) {
        e.preventDefault(); // Empêche le rechargement de la page

        // Validation des champs (mot de passe et e-mail)
        let password = $("#Password").val();
        let passwordVerification = $("#PasswordVerification").val();
        let email = $("#Email").val();
        let emailVerification = $("#EmailVerification").val();
        console.log(password);
        console.log(passwordVerification);
        if (password !== passwordVerification) {
            $("#errorMessage").text("Les mots de passe doivent être identique").show();
            return;
        }
        if (email !== emailVerification) {
            $("#errorMessage").text("Les Email doivent être identique").show();
            return;
        }

        // Récupération des données du formulaire
        let name = $("#Username").val();
        let post = getFormData($(".createAccountForm"));
        let user = JSON.parse(sessionStorage.getItem("User"));
        let userObject = {
            Id: user.Id,
            Name: name,
            Password: password,
            Email: email,
            Avatar: post.Image
        };
        console.log(userObject);
        let response = await users_API.Modify(userObject); // Enregistrement de l'utilisateur
        if (response != null) {
            await users_API.Logout(user.Id);
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("User");
            if(user.Email != email)
            {
                sessionStorage.setItem("messageCode", "Votre compte à été créé. Veuillez prendre vos courriels pour récupérer votre code de vérification qui vous sera demandé lors de votre prochaine connexion.");
            }
            renderLoginForm(); // Redirection vers le formulaire de connexion
        }
        else {
            $("#errorMessage").text(users_API.currentHttpError).show();
        }
    });
}
async function renderUserManager() {
    noTimeout();
    $("#viewTitle").text("Gestion d'usagers");
    $("#commit").hide();
    $("#form").show();
    $("#form").empty();
    //Html et User
    let users = await users_API.Get();
    console.log(users);
    let usersHtml = "";
    users.data.forEach(user => {
        //Niveau d'autorisations
        let autorization = "promoteCmd fa-solid fa-user";
        if (user.isAdmin) {
            autorization = "promoteCmd fa-solid fa-user-tie"
        }
        else if (user.isSuper) {
            autorization = "promoteCmd fa-solid fa-user-gear"
        }
        //Bloqué ?
        let blocked = "";
        if(user.isBlocked){
            blocked = "color : red";
        }
        usersHtml += `
            <div class="userManagerRow" userId="${user.Id}">
                <img src="${user.Avatar}" />
                <span>${user.Name}</span>
                <i class="${autorization}"></i>
                <i class="blockCmd fa-solid fa-ban" style="${blocked}"></i>
                <i class="eraseCmd fa-solid fa-trash"></i>
            </div>
        `;
    })
    //Peuplement de la page
    $("#form").append($(` 
        <div class="userManagerContainer">
            ${usersHtml}
        </div>
    `));
    //Boutons
    $('.promoteCmd').on("click", async function () {
        let id = $(this).parent().attr('userId');
        let user = await users_API.Get(id);
        await users_API.Promote(user.data);
        renderUserManager();
    });
    $('.blockCmd').on("click", async function () {
        let id = $(this).parent().attr('userId');
        let user = await users_API.Get(id);
        await users_API.Block(user.data);
        renderUserManager();
    });
    $('.eraseCmd').on("click", async function () {
        let id = $(this).parent().attr('userId');
        renderConfirmationDelete(id);
    });
}
async function renderConfirmationDelete(id) {
    timeout(60);
    let user = await users_API.Get(id);
    console.log(user);
    $("#form").empty();
    $("#form").append($(` 
        <form class="deleteForm">
            <h2>Voulez-vous vraiment supprimer cet usager ?</h2>
            <div class="userManagerRow inDelete">
                <img src="${user.data.Avatar}" />
                <span>${user.data.Name}</span>
            </div>
            <div class="form-submit-section">
                <input type="submit" value="Oui" id="deleteCmd" class="btn btn-primary deleteBtn"/>
                <hr/>
                <input type="submit"value="Non" id="cancelCmd" class="btn btn-secondary"/>
            </div>
        </form>
    `));
    $('#deleteCmd').on("click", async function () {
        let posts = await Posts_API.Get();
            //console.log(posts.data);
            let likes = await users_API.getAllLike();
            likes.forEach(elem => {
                	if(elem.idUser == user.Id)
                    {
                        users_API.Unlike(elem.Id);
                    }
            });
            posts.data.forEach(element => {
                if(element.UserId==user.Id)
                {
                    Posts_API.Delete(element.Id);
                }
            });
        await users_API.Remove(id);
        renderUserManager();
    });
    $('#cancelCmd').on("click", async function () {
        renderUserManager();
    });
}
function getFormData($form) {
    // prevent html injections
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    // grab data from all controls
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}
